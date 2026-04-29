<?php

namespace App\Actions\Tasks;

use App\Events\BoardChanged;
use App\Models\Comment;
use App\Models\Task;
use App\Models\User;
use App\Services\ActivityLogger;
use App\Support\RichTextSanitizer;
use Lorisleiva\Actions\Concerns\AsAction;

class CreateComment
{
    use AsAction;

    public function handle(Task $task, string $body, User $user, ?string $parentId = null): Comment
    {
        $parent = $parentId ? $task->comments()->findOrFail($parentId) : null;

        $comment = $task->comments()->create([
            'user_id' => $user->id,
            'body' => RichTextSanitizer::sanitize($body),
            'parent_id' => $parentId,
        ]);

        if (! $parentId) {
            // Top-level comments: full notification flow (assignees + mentions)
            ActivityLogger::log($task, 'commented', [
                'comment_id' => $comment->id,
            ], $user);
        } else {
            ActivityLogger::notifyCommentReply($task, $comment, $parent, $user);
        }

        if ($parentId) {
            broadcast(new BoardChanged(
                boardId: $task->board_id,
                action: 'comment.replied',
                data: [
                    'task_id' => $task->id,
                    'comment_id' => $comment->id,
                    'parent_id' => $parentId,
                ],
                userId: $user->id,
            ))->toOthers();
        }

        return $comment->load('user');
    }
}
