<?php

namespace App\Http\Controllers;

use App\Models\Activity;
use App\Models\Board;
use App\Models\Task;
use App\Models\Team;
use App\Services\TeamStatsService;
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

        // Open = not completed. Moving into a done column sets completed_at,
        // so this matches team stats, reminders and Task::open().
        $openAssigned = (clone $assigned)->open();

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

        // Done = completed, the same definition team stats use.
        $totals = DB::table('tasks')
            ->whereIn('tasks.board_id', $boardIds)
            ->groupBy('tasks.board_id')
            ->selectRaw('tasks.board_id, count(*) as total')
            ->selectRaw('sum(case when tasks.completed_at is not null then 1 else 0 end) as done')
            ->get()
            ->keyBy('board_id');

        $myOpen = DB::table('tasks')
            ->join('task_assignees', 'task_assignees.task_id', '=', 'tasks.id')
            ->where('task_assignees.user_id', $userId)
            ->whereIn('tasks.board_id', $boardIds)
            ->whereNull('tasks.completed_at')
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

                // Sorted: JSON key order differs between MySQL and SQLite.
                $fields = array_keys($changes);
                sort($fields);

                $summary = $activity->action === 'field_changed'
                    ? ['fields' => $fields]
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
                    'actor_deleted' => $activity->actor_deleted,
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

    public function teamStats(Request $request, Team $team, TeamStatsService $stats): JsonResponse
    {
        $this->authorize('view', $team);

        return response()->json($stats->stats($team));
    }

    public function exportCsv(Request $request, Team $team, TeamStatsService $stats): StreamedResponse
    {
        $this->authorize('view', $team);

        return $stats->exportCsv($team);
    }
}
