<?php

namespace App\Actions\Tasks;

use App\Models\Comment;
use Lorisleiva\Actions\Concerns\AsAction;

class DeleteComment
{
    use AsAction;

    public function handle(Comment $comment): void
    {
        $comment->delete();
    }
}
