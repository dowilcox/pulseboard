<?php

namespace App\Http\Controllers;

use App\Models\Activity;
use App\Models\Board;
use App\Models\Task;
use App\Models\Team;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

class DashboardController extends Controller
{
    /**
     * Activity changes worth sending to the dashboard feed. Anything else
     * (e.g. full description bodies on field_changed) stays server-side.
     */
    private const ACTIVITY_CHANGE_KEYS = [
        'from_column',
        'to_column',
        'from_board',
        'to_board',
        'auto_moved',
        'users',
        'added',
        'removed',
        'depends_on_title',
        'filename',
        'branch',
        'mr_title',
        'title',
    ];

    public function index(Request $request): Response
    {
        $user = $request->user();
        $now = now();
        $today = $now->copy()->startOfDay();
        $todayDate = $today->toDateString();

        $teams = $user->teams()
            ->select('teams.id', 'teams.name', 'teams.slug')
            ->get()
            ->keyBy('id');

        $boards = Board::query()
            ->whereIn('team_id', $teams->keys())
            ->active()
            ->with('media')
            ->orderBy('sort_order')
            ->get(['id', 'team_id', 'name', 'slug', 'sort_order', 'updated_at']);

        $boardIds = $boards->pluck('id');

        // Tasks assigned to this user on active boards of teams they belong to.
        $assigned = Task::query()
            ->whereIn('tasks.board_id', $boardIds)
            ->whereHas('assignees', fn ($q) => $q->where('users.id', $user->id));

        // Open = not completed and not sitting in a done column.
        $openAssigned = (clone $assigned)
            ->whereNull('tasks.completed_at')
            ->whereHas('column', fn ($q) => $q->where('is_done_column', false));

        $stats = [
            'open' => (clone $openAssigned)->count(),
            'overdue' => (clone $openAssigned)
                ->where('due_date', '<', $todayDate)
                ->count(),
            'due_next_7_days' => (clone $openAssigned)
                ->where('due_date', '>=', $todayDate)
                ->where('due_date', '<', $today->copy()->addDays(8)->toDateString())
                ->count(),
            'completed_last_7_days' => (clone $assigned)
                ->where('completed_at', '>=', $now->copy()->subDays(7))
                ->count(),
            'completed_previous_7_days' => (clone $assigned)
                ->where('completed_at', '>=', $now->copy()->subDays(14))
                ->where('completed_at', '<', $now->copy()->subDays(7))
                ->count(),
        ];

        // Ordered by due date first so the deadline groups (derived client-side
        // in the viewer's timezone) are complete even when the list is capped.
        $myTasks = (clone $openAssigned)
            ->select([
                'tasks.id',
                'tasks.board_id',
                'tasks.column_id',
                'tasks.gitlab_project_id',
                'tasks.task_number',
                'tasks.title',
                'tasks.priority',
                'tasks.due_date',
                'tasks.completed_at',
                'tasks.created_at',
                'tasks.updated_at',
            ])
            ->with([
                'board:id,team_id,name,slug',
                'board.team:id,name,slug',
                'column:id,name,color,is_done_column',
                'labels',
                'gitlabProject:id,path_with_namespace',
            ])
            ->orderByRaw('case when tasks.due_date is null then 1 else 0 end')
            ->orderBy('tasks.due_date')
            ->orderByRaw(
                "case tasks.priority when 'urgent' then 0 when 'high' then 1 when 'medium' then 2 when 'low' then 3 else 4 end",
            )
            ->orderByDesc('tasks.updated_at')
            ->limit(200)
            ->get();

        return Inertia::render('Dashboard', [
            'stats' => $stats,
            'boards' => $this->boardSummaries($boards, $teams, $user->id),
            'myTasks' => $myTasks,
            'recentActivity' => $this->recentActivity($boards, $teams),
        ]);
    }

    /**
     * Per-board totals for the dashboard cards, aggregated in three grouped
     * queries regardless of the number of boards.
     *
     * @param  Collection<int, Board>  $boards
     * @param  Collection<string, Team>  $teams
     */
    private function boardSummaries(Collection $boards, Collection $teams, string $userId): array
    {
        $boardIds = $boards->pluck('id');

        // Done = completed or sitting in a done column.
        $totals = DB::table('tasks')
            ->join('columns', 'columns.id', '=', 'tasks.column_id')
            ->whereIn('tasks.board_id', $boardIds)
            ->groupBy('tasks.board_id')
            ->selectRaw('tasks.board_id, count(*) as total')
            ->selectRaw('sum(case when tasks.completed_at is not null or columns.is_done_column = 1 then 1 else 0 end) as done')
            ->get()
            ->keyBy('board_id');

        $myOpen = DB::table('tasks')
            ->join('columns', 'columns.id', '=', 'tasks.column_id')
            ->join('task_assignees', 'task_assignees.task_id', '=', 'tasks.id')
            ->where('task_assignees.user_id', $userId)
            ->whereIn('tasks.board_id', $boardIds)
            ->whereNull('tasks.completed_at')
            ->where('columns.is_done_column', false)
            ->groupBy('tasks.board_id')
            ->selectRaw('tasks.board_id, count(*) as aggregate')
            ->pluck('aggregate', 'board_id');

        $lastActivity = DB::table('activities')
            ->join('tasks', 'tasks.id', '=', 'activities.task_id')
            ->whereIn('tasks.board_id', $boardIds)
            ->groupBy('tasks.board_id')
            ->selectRaw('tasks.board_id, max(activities.created_at) as last_activity_at')
            ->pluck('last_activity_at', 'board_id');

        return $boards
            ->map(function (Board $board) use ($totals, $myOpen, $lastActivity, $teams) {
                $total = (int) ($totals->get($board->id)->total ?? 0);
                $done = (int) ($totals->get($board->id)->done ?? 0);

                $lastActivityAt = $board->updated_at;
                if ($lastActivity->has($board->id)) {
                    $taskActivityAt = Carbon::parse($lastActivity->get($board->id));
                    if (! $lastActivityAt || $taskActivityAt->gt($lastActivityAt)) {
                        $lastActivityAt = $taskActivityAt;
                    }
                }

                $team = $teams->get($board->team_id);

                return [
                    'id' => $board->id,
                    'name' => $board->name,
                    'slug' => $board->slug,
                    'image_url' => $board->image_url,
                    'team' => [
                        'id' => $team->id,
                        'name' => $team->name,
                        'slug' => $team->slug,
                    ],
                    'total_tasks' => $total,
                    'done_tasks' => $done,
                    'open_tasks' => $total - $done,
                    'my_open_tasks' => (int) ($myOpen->get($board->id) ?? 0),
                    'last_activity_at' => $lastActivityAt?->toIso8601String(),
                    'sort_timestamp' => $lastActivityAt?->getTimestamp() ?? 0,
                ];
            })
            ->sortByDesc('sort_timestamp')
            ->map(fn (array $summary) => Arr::except($summary, 'sort_timestamp'))
            ->values()
            ->all();
    }

    /**
     * Latest activity on the user's boards, reduced to what the feed renders.
     *
     * @param  Collection<int, Board>  $boards
     * @param  Collection<string, Team>  $teams
     */
    private function recentActivity(Collection $boards, Collection $teams): array
    {
        $boardsById = $boards->keyBy('id');

        return Activity::query()
            ->select('activities.*')
            ->join('tasks', 'tasks.id', '=', 'activities.task_id')
            ->whereIn('tasks.board_id', $boardsById->keys())
            ->orderByDesc('activities.created_at')
            ->limit(8)
            ->with(['user', 'task:id,board_id,task_number,title'])
            ->get()
            ->map(function (Activity $activity) use ($boardsById, $teams) {
                $task = $activity->task;
                $board = $boardsById->get($task->board_id);
                $team = $teams->get($board->team_id);
                $changes = $activity->changes ?? [];

                $summary = $activity->action === 'field_changed'
                    ? ['fields' => array_keys($changes)]
                    : Arr::only($changes, self::ACTIVITY_CHANGE_KEYS);

                return [
                    'id' => $activity->id,
                    'action' => $activity->action,
                    'changes' => (object) $summary,
                    'created_at' => $activity->created_at?->toIso8601String(),
                    'user' => $activity->user ? [
                        'id' => $activity->user->id,
                        'name' => $activity->user->name,
                        'avatar_url' => $activity->user->avatar_url,
                    ] : null,
                    'task' => [
                        'id' => $task->id,
                        'title' => $task->title,
                        'task_number' => $task->task_number,
                        'slug' => $task->slug,
                    ],
                    'board' => [
                        'id' => $board->id,
                        'name' => $board->name,
                        'slug' => $board->slug,
                    ],
                    'team' => [
                        'id' => $team->id,
                        'name' => $team->name,
                        'slug' => $team->slug,
                    ],
                ];
            })
            ->all();
    }

    public function teamStats(Request $request, Team $team): JsonResponse
    {
        $this->authorize('view', $team);

        // Archived boards are hidden from the team page, so keep their tasks
        // out of the team's headline stats too.
        $boardIds = $team->boards()->active()->pluck('id');

        // Task counts by column (for burndown-like data)
        $tasksByColumn = Task::whereIn('tasks.board_id', $boardIds)
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
            ->open()
            ->with(['board.media', 'column', 'assignees'])
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
            ->where('activities.changes->to_done', true)
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
            ->where('activities.changes->to_done', true)
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

    public function exportCsv(Request $request, Team $team): StreamedResponse
    {
        $this->authorize('view', $team);

        $boardIds = $team->boards()->pluck('id');

        $tasks = Task::whereIn('board_id', $boardIds)
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
