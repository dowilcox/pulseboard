<?php

namespace App\Http\Controllers;

use App\Models\Task;
use App\Models\Team;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    public function index(): Response
    {
        $user = auth()->user();

        // My tasks: all tasks assigned to this user across all boards
        $myTasks = Task::whereHas('assignees', function ($q) use ($user) {
            $q->where('users.id', $user->id);
        })
            ->with(['board.team', 'column', 'assignees', 'labels'])
            ->withCount(['comments', 'subtasks'])
            ->orderByRaw("CASE priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 WHEN 'low' THEN 4 ELSE 5 END")
            ->orderBy('due_date')
            ->get();

        return Inertia::render('Dashboard', [
            'myTasks' => $myTasks,
        ]);
    }

    public function teamDashboard(Team $team): Response
    {
        $this->authorize('view', $team);

        return Inertia::render('Teams/Dashboard', [
            'team' => $team,
        ]);
    }

    public function teamStats(Request $request, Team $team): JsonResponse
    {
        $this->authorize('view', $team);

        $boardIds = $team->boards()->pluck('id');

        // Task counts by column (for burndown-like data)
        $tasksByColumn = Task::whereIn('board_id', $boardIds)
            ->join('columns', 'tasks.column_id', '=', 'columns.id')
            ->select('columns.name as column_name', 'columns.is_done_column', DB::raw('count(*) as count'))
            ->groupBy('columns.name', 'columns.is_done_column')
            ->get();

        // Tasks by priority
        $tasksByPriority = Task::whereIn('board_id', $boardIds)
            ->select('priority', DB::raw('count(*) as count'))
            ->groupBy('priority')
            ->pluck('count', 'priority');

        // Overdue tasks
        $overdueTasks = Task::whereIn('board_id', $boardIds)
            ->whereNotNull('due_date')
            ->where('due_date', '<', now()->startOfDay())
            ->whereHas('column', fn ($q) => $q->where('is_done_column', false))
            ->with(['board', 'column', 'assignees'])
            ->orderBy('due_date')
            ->limit(20)
            ->get();

        // Workload distribution (tasks per assignee)
        $workload = DB::table('task_assignees')
            ->join('tasks', 'task_assignees.task_id', '=', 'tasks.id')
            ->join('users', 'task_assignees.user_id', '=', 'users.id')
            ->join('columns', 'tasks.column_id', '=', 'columns.id')
            ->whereIn('tasks.board_id', $boardIds)
            ->where('columns.is_done_column', false)
            ->select('users.name', DB::raw('count(*) as task_count'), DB::raw('coalesce(sum(tasks.effort_estimate), 0) as total_effort'))
            ->groupBy('users.name')
            ->orderByDesc('task_count')
            ->get();

        // Velocity: tasks completed per week (last 8 weeks)
        $velocity = DB::table('activities')
            ->join('tasks', 'activities.task_id', '=', 'tasks.id')
            ->whereIn('tasks.board_id', $boardIds)
            ->where('activities.action', 'moved')
            ->where('activities.created_at', '>=', now()->subWeeks(8))
            ->whereRaw("JSON_EXTRACT(activities.changes, '$.to_done') = true")
            ->select(DB::raw('YEARWEEK(activities.created_at) as week'), DB::raw('count(*) as completed'))
            ->groupBy('week')
            ->orderBy('week')
            ->get();

        // Cycle time: avg days from creation to done (last 30 days)
        $cycleTime = DB::table('activities')
            ->join('tasks', 'activities.task_id', '=', 'tasks.id')
            ->whereIn('tasks.board_id', $boardIds)
            ->where('activities.action', 'moved')
            ->where('activities.created_at', '>=', now()->subDays(30))
            ->whereRaw("JSON_EXTRACT(activities.changes, '$.to_done') = true")
            ->select(DB::raw('AVG(DATEDIFF(activities.created_at, tasks.created_at)) as avg_days'))
            ->value('avg_days');

        return response()->json([
            'tasks_by_column' => $tasksByColumn,
            'tasks_by_priority' => $tasksByPriority,
            'overdue_tasks' => $overdueTasks,
            'workload' => $workload,
            'velocity' => $velocity,
            'cycle_time' => round((float) ($cycleTime ?? 0), 1),
        ]);
    }

    public function exportCsv(Request $request, Team $team): \Symfony\Component\HttpFoundation\StreamedResponse
    {
        $this->authorize('view', $team);

        $boardIds = $team->boards()->pluck('id');

        $tasks = Task::whereIn('board_id', $boardIds)
            ->with(['board', 'column', 'assignees', 'labels'])
            ->orderBy('board_id')
            ->orderBy('sort_order')
            ->get();

        return response()->streamDownload(function () use ($tasks) {
            $handle = fopen('php://output', 'w');

            fputcsv($handle, [
                'Board', 'Column', 'Task Number', 'Title', 'Priority',
                'Status', 'Due Date', 'Assignees', 'Labels', 'Effort',
                'Created At',
            ]);

            foreach ($tasks as $task) {
                fputcsv($handle, [
                    $task->board->name ?? '',
                    $task->column->name ?? '',
                    'PB-'.$task->task_number,
                    $task->title,
                    $task->priority,
                    $task->column->is_done_column ? 'Done' : 'In Progress',
                    $task->due_date?->format('Y-m-d') ?? '',
                    $task->assignees->pluck('name')->join(', '),
                    $task->labels->pluck('name')->join(', '),
                    $task->effort_estimate ?? '',
                    $task->created_at->format('Y-m-d H:i'),
                ]);
            }

            fclose($handle);
        }, $team->name.'-tasks-'.now()->format('Y-m-d').'.csv', [
            'Content-Type' => 'text/csv',
        ]);
    }
}
