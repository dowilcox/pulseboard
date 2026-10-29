<?php

namespace App\Mcp\Tools;

use App\Mcp\Support\Presenter;
use App\Models\User;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Illuminate\Notifications\DatabaseNotification;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\Server\Attributes\Description;
use Laravel\Mcp\Server\Attributes\Name;
use Laravel\Mcp\Server\Tools\Annotations\IsReadOnly;

#[Name('list_notifications')]
#[Description('List your PulseBoard notifications (assignments, mentions, comments, due dates, ...), newest first, with the related task\'s team/board/task identifiers and URL. Includes the total unread count. Use mark_notifications_read to mark them read.')]
#[IsReadOnly]
class ListNotifications extends PulseBoardTool
{
    public function schema(JsonSchema $schema): array
    {
        return [
            'unread_only' => $schema->boolean()->description('Only unread notifications. Default false.'),
            'limit' => $schema->integer()->min(1)->max(200)->description('Max notifications (default 20, max 200).'),
            'offset' => $schema->integer()->min(0)->description('Number of notifications to skip, for pagination.'),
        ];
    }

    protected function run(Request $request, User $user): Response
    {
        $request->validate([
            'unread_only' => ['nullable', 'boolean'],
            'limit' => ['nullable', 'integer', 'min:1'],
            'offset' => ['nullable', 'integer', 'min:0'],
        ]);

        $query = $request->boolean('unread_only')
            ? $user->unreadNotifications()
            : $user->notifications();

        $total = (clone $query)->count();
        $limit = $this->limit($request, 20);
        $offset = $this->offset($request);

        $notifications = $query->reorder()->latest()->offset($offset)->limit($limit)->get();

        return $this->page(
            'notifications',
            $notifications->map(fn (DatabaseNotification $n) => $this->present($n))->values()->all(),
            $total,
            $offset,
            $limit,
            ['unread_count' => $user->unreadNotifications()->count()],
        );
    }

    private function present(DatabaseNotification $notification): array
    {
        $data = $notification->data;
        $url = null;

        if (! empty($data['team_slug']) && ! empty($data['board_slug']) && ! empty($data['task_slug'])) {
            $url = route('tasks.show', [$data['team_slug'], $data['board_slug'], $data['task_slug']]);
        }

        return Presenter::compact([
            'id' => $notification->id,
            'type' => $data['type'] ?? class_basename($notification->type),
            'message' => $data['message'] ?? null,
            'read' => $notification->read_at !== null,
            'created_at' => Presenter::timestamp($notification->created_at),
            'task_id' => $data['task_id'] ?? null,
            'task_title' => $data['task_title'] ?? null,
            'team' => $data['team_slug'] ?? null,
            'board' => $data['board_slug'] ?? null,
            'url' => $url,
        ]);
    }
}
