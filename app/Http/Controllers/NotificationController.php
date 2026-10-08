<?php

namespace App\Http\Controllers;

use App\Models\Board;
use App\Models\Task;
use App\Models\Team;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Notifications\DatabaseNotification;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;

class NotificationController extends Controller
{
    private const PER_PAGE = 20;

    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $notifications = $user->notifications()
            ->latest()
            // Tie-breaker so offset pages stay stable for same-second rows.
            ->orderByDesc('id')
            ->paginate(self::PER_PAGE);

        return response()->json([
            'data' => $this->withLinks($user, collect($notifications->items())),
            'current_page' => $notifications->currentPage(),
            'last_page' => $notifications->lastPage(),
            'per_page' => $notifications->perPage(),
            'total' => $notifications->total(),
            'next_page_url' => $notifications->nextPageUrl(),
            'prev_page_url' => $notifications->previousPageUrl(),
            'unread_count' => $user->unreadNotifications()->count(),
        ]);
    }

    public function markRead(Request $request, string $id): JsonResponse
    {
        $notification = $request->user()
            ->notifications()
            ->findOrFail($id);

        $notification->markAsRead();

        return response()->json(['success' => true]);
    }

    public function markAllRead(Request $request): JsonResponse
    {
        $request->user()->unreadNotifications()->update(['read_at' => now()]);

        return response()->json(['success' => true]);
    }

    public function clearAll(Request $request): JsonResponse
    {
        $request->user()->notifications()->delete();

        return response()->json(['success' => true]);
    }

    /**
     * Attach a `url` and `context` (team/board names) to each notification.
     *
     * Slugs stored in the payload go stale when a team, board or task is
     * renamed or a task moves boards, so links are built from the current
     * records looked up by ID. They degrade from task to board to team, and
     * are null when nothing resolves or the user is no longer a team member.
     *
     * @param  Collection<int, DatabaseNotification>  $notifications
     * @return array<int, array<string, mixed>>
     */
    private function withLinks(User $user, Collection $notifications): array
    {
        $payloads = $notifications->map(fn (DatabaseNotification $n) => is_array($n->data) ? $n->data : []);

        $tasks = Task::query()
            ->whereIn('id', $this->uuids($payloads, 'task_id'))
            ->get(['id', 'board_id', 'task_number', 'title'])
            ->keyBy('id');

        $boards = Board::query()
            ->whereIn('id', $this->uuids($payloads, 'board_id')->merge($tasks->pluck('board_id'))->unique()->values())
            ->get(['id', 'team_id', 'name', 'slug'])
            ->keyBy('id');

        $teams = Team::query()
            ->whereIn('id', $this->uuids($payloads, 'team_id')->merge($boards->pluck('team_id'))->unique()->values())
            ->get(['id', 'name', 'slug'])
            ->keyBy('id');

        $memberTeamIds = $user->teams()->pluck('teams.id')->flip();

        return $notifications->map(function (DatabaseNotification $notification) use ($tasks, $boards, $teams, $memberTeamIds) {
            $data = is_array($notification->data) ? $notification->data : [];

            $task = $tasks->get($data['task_id'] ?? null);
            $board = $task ? $boards->get($task->board_id) : $boards->get($data['board_id'] ?? null);
            $team = $board ? $teams->get($board->team_id) : $teams->get($data['team_id'] ?? null);

            $url = null;
            $context = null;

            if ($team && $memberTeamIds->has($team->id)) {
                $context = [
                    'team_name' => $team->name,
                    'board_name' => $board?->name,
                ];

                $url = match (true) {
                    $task && $board => route('tasks.show', [$team->slug, $board->slug, $task->getRouteKey()], false),
                    $board !== null => route('teams.boards.show', [$team->slug, $board->slug], false),
                    default => route('teams.show', $team->slug, false),
                };
            }

            return array_merge($notification->toArray(), [
                'url' => $url,
                'context' => $context,
            ]);
        })->values()->all();
    }

    /**
     * @param  Collection<int, array<string, mixed>>  $payloads
     * @return Collection<int, string>
     */
    private function uuids(Collection $payloads, string $key): Collection
    {
        return $payloads
            ->pluck($key)
            ->filter(fn ($id) => is_string($id) && Str::isUuid($id))
            ->unique()
            ->values();
    }
}
