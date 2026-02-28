<?php

namespace App\Actions\Tasks;

use App\Models\Comment;
use Lorisleiva\Actions\Concerns\AsAction;

class UpdateComment
{
    use AsAction;

    public function handle(Comment $comment, string $body): Comment
    {
        $comment->update(['body' => $body]);

        return $comment->fresh();
    }
}
