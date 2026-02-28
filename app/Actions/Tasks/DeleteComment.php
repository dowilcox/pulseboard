<?php

namespace App\Actions\Tasks;

use App\Events\BoardChanged;
use App\Models\Comment;
use Illuminate\Support\Facades\Auth;
use Lorisleiva\Actions\Concerns\AsAction;

class DeleteComment
{
    use AsAction;

    public function handle(Comment $comment): void
    {
        $taskId = $comment->task_id;
        $boardId = $comment->task->board_id;
        $commentId = $comment->id;

        $comment->delete();

        broadcast(new BoardChanged(
            boardId: $boardId,
            action: 'comment.deleted',
            data: [
                'task_id' => $taskId,
                'comment_id' => $commentId,
            ],
            userId: Auth::id(),
        ))->toOthers();
    }
}
