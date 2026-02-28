<?php

namespace App\Actions\Tasks;

use App\Events\BoardChanged;
use App\Models\Comment;
use Illuminate\Support\Facades\Auth;
use Lorisleiva\Actions\Concerns\AsAction;

class UpdateComment
{
    use AsAction;

    public function handle(Comment $comment, string $body): Comment
    {
        $comment->update(['body' => $body]);

        $comment = $comment->fresh();

        broadcast(new BoardChanged(
            boardId: $comment->task->board_id,
            action: 'comment.updated',
            data: [
                'task_id' => $comment->task_id,
                'comment_id' => $comment->id,
            ],
            userId: Auth::id(),
        ))->toOthers();

        return $comment;
    }
}
