<?php

namespace App\Mcp\Tools;

use App\Mcp\Exceptions\ToolException;
use App\Models\User;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\Server\Attributes\Description;
use Laravel\Mcp\Server\Attributes\Name;
use Laravel\Mcp\Server\Tools\Annotations\IsIdempotent;

#[Name('mark_notifications_read')]
#[Description('Mark your notifications as read: pass `ids` (from list_notifications) or `all: true`. Requires a token with the "write" ability.')]
#[IsIdempotent]
class MarkNotificationsRead extends PulseBoardTool
{
    protected ?string $ability = 'write';

    public function schema(JsonSchema $schema): array
    {
        return [
            'ids' => $schema->array()->items($schema->string())->description('Notification ids to mark read.'),
            'all' => $schema->boolean()->description('Mark every unread notification as read.'),
        ];
    }

    protected function run(Request $request, User $user): Response
    {
        $request->validate([
            'ids' => ['nullable', 'array', 'max:200'],
            'ids.*' => ['string', 'max:64'],
            'all' => ['nullable', 'boolean'],
        ]);

        if ($request->boolean('all')) {
            $count = $user->unreadNotifications()->update(['read_at' => now()]);
        } elseif (filled($request->get('ids'))) {
            $count = $user->unreadNotifications()
                ->whereIn('id', $request->get('ids'))
                ->update(['read_at' => now()]);
        } else {
            throw new ToolException('Pass `ids` or `all: true`.');
        }

        return $this->json([
            'marked_read' => $count,
            'unread_count' => $user->unreadNotifications()->count(),
        ]);
    }
}
