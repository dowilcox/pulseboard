<?php

namespace App\Actions\Tasks;

use App\Events\BoardChanged;
use App\Models\Comment;
use App\Models\Task;
use App\Models\User;
use App\Services\ActivityLogger;
use Lorisleiva\Actions\Concerns\AsAction;

class CreateComment
{
    use AsAction;

    public function handle(Task $task, string $body, User $user): Comment
    {
        $comment = $task->comments()->create([
            'user_id' => $user->id,
            'body' => $body,
        ]);

        ActivityLogger::log($task, 'commented', [], $user);

        broadcast(new BoardChanged(
            boardId: $task->board_id,
            action: 'comment.created',
            data: [
                'task_id' => $task->id,
                'comment_id' => $comment->id,
            ],
            userId: $user->id,
        ))->toOthers();

        return $comment->load('user');
    }
}
