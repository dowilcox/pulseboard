<?php

namespace App\Actions\Tasks;

use App\Events\BoardChanged;
use App\Models\Comment;
use App\Notifications\TaskMentionedNotification;
use App\Services\ActivityLogger;
use App\Services\MentionParser;
use App\Support\RichTextSanitizer;
use Illuminate\Support\Facades\Auth;
use Lorisleiva\Actions\Concerns\AsAction;

class UpdateComment
{
    use AsAction;

    public function handle(Comment $comment, string $body): Comment
    {
        $oldBody = $comment->body;

        $comment->update(['body' => RichTextSanitizer::sanitize($body)]);

        $comment = $comment->fresh();

        $this->notifyNewMentions($comment, $oldBody);

        broadcast(new BoardChanged(
            boardId: $comment->task->board_id,
            action: 'comment.updated',
            data: [
                'task_id' => $comment->task_id,
                'comment_id' => $comment->id,
            ],
            userId: Auth::id() ?? 'system',
        ))->toOthers();

        return $comment;
    }

    private function notifyNewMentions(Comment $comment, ?string $oldBody): void
    {
        $actor = Auth::user();
        if (! $actor) {
            return;
        }

        $task = $comment->task;
        $task->loadMissing('board.team');

        $newMentions = MentionParser::findNewMentions(
            $oldBody,
            $comment->body,
            [$actor->id],
            $task->board->team,
        );

        foreach ($newMentions as $user) {
            $notification = new TaskMentionedNotification($task, $actor, $comment);
            $user->notify($notification);

            ActivityLogger::broadcastDatabaseNotification(
                $user,
                $notification,
                "{$actor->name} mentioned you in \"{$task->title}\"",
                'TaskMentionedNotification',
            );
        }
    }
}
