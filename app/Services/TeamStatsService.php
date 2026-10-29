<?php

namespace App\Services;

use App\Models\Task;
use App\Models\Team;
use Carbon\CarbonInterface;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Team-level stats and CSV export, shared by the web team page and the v1 API.
 *
 * Both only cover the team's active (non-archived) boards, and both use
 * completed_at as the single definition of "done".
 */
class TeamStatsService
{
    /**
     * @return array<string, mixed>
     */
    public function stats(Team $team): array
    {
        $boardIds = $this->activeBoardIds($team);

        // Task counts by column (for burndown-like data). Plain rows, so
        // Task's appended attributes don't leak into the aggregate.
        $tasksByColumn = Task::whereIn('tasks.board_id', $boardIds)
            ->join('columns', 'tasks.column_id', '=', 'columns.id')
            ->select('columns.name as column_name', 'columns.is_done_column', DB::raw('count(*) as count'))
            ->groupBy('columns.name', 'columns.is_done_column')
            ->toBase()
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
            ->open()
            ->with(['board.media', 'column', 'assignees'])
            ->orderBy('due_date')
            ->limit(20)
            ->get();

        // Workload distribution (open tasks per assignee)
        $workload = DB::table('task_assignees')
            ->join('tasks', 'task_assignees.task_id', '=', 'tasks.id')
            ->join('users', 'task_assignees.user_id', '=', 'users.id')
            ->whereIn('tasks.board_id', $boardIds)
            ->whereNull('tasks.completed_at')
            ->select('users.name', DB::raw('count(*) as task_count'), DB::raw('coalesce(sum(tasks.effort_estimate), 0) as total_effort'))
            ->groupBy('users.name')
            ->orderByDesc('task_count')
            ->get();

        return [
            'tasks_by_column' => $tasksByColumn,
            'tasks_by_priority' => $tasksByPriority,
            'overdue_tasks' => $overdueTasks,
            'workload' => $workload,
            'velocity' => $this->velocity($boardIds),
            'cycle_time' => $this->cycleTime($boardIds),
        ];
    }

    /**
     * Tasks completed per week over the last 8 weeks, keyed by the Monday
     * that starts each week (app timezone). Weeks without completions are
     * omitted. Grouped in PHP so it works the same on MySQL and SQLite.
     *
     * @param  Collection<int, string>  $boardIds
     * @return list<array{week: string, completed: int}>
     */
    private function velocity(Collection $boardIds): array
    {
        return Task::whereIn('board_id', $boardIds)
            ->completed()
            ->where('completed_at', '>=', now()->subWeeks(8))
            ->pluck('completed_at')
            ->groupBy(fn (CarbonInterface $completedAt) => $completedAt
                ->copy()
                ->setTimezone(config('app.timezone'))
                ->startOfWeek(CarbonInterface::MONDAY)
                ->toDateString())
            ->sortKeys()
            ->map(fn (Collection $completions, string $week) => [
                'week' => $week,
                'completed' => $completions->count(),
            ])
            ->values()
            ->all();
    }

    /**
     * Average days from creation to completion for tasks completed in the
     * last 30 days, rounded to one decimal. 0 when nothing was completed.
     *
     * @param  Collection<int, string>  $boardIds
     */
    private function cycleTime(Collection $boardIds): float
    {
        $days = Task::whereIn('board_id', $boardIds)
            ->completed()
            ->where('completed_at', '>=', now()->subDays(30))
            ->get(['created_at', 'completed_at'])
            ->map(fn (Task $task) => max(0, $task->created_at->diffInSeconds($task->completed_at)) / 86400);

        return $days->isEmpty() ? 0.0 : round($days->avg(), 1);
    }

    public function exportCsv(Team $team): StreamedResponse
    {
        $tasks = Task::whereIn('board_id', $this->activeBoardIds($team))
            ->with(['board.media', 'column', 'assignees', 'labels'])
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
                    '#'.$task->task_number,
                    $task->title,
                    $task->priority,
                    $task->completed_at ? 'Done' : 'In Progress',
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

    /**
     * Archived boards are hidden from the team page, so their tasks stay
     * out of the team's stats and export too.
     *
     * @return Collection<int, string>
     */
    private function activeBoardIds(Team $team): Collection
    {
        return $team->boards()->active()->pluck('id');
    }
}
