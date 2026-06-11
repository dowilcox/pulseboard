<?php

namespace App\Policies;

use App\Models\Comment;
use App\Models\User;
use App\Policies\Concerns\ChecksTeamRoles;

class CommentPolicy
{
    use ChecksTeamRoles;

    public function update(User $user, Comment $comment): bool
    {
        return $comment->user_id === $user->id;
    }

    public function delete(User $user, Comment $comment): bool
    {
        if ($comment->user_id === $user->id) {
            return true;
        }

        return $this->isOwnerOrAdmin($user, $comment->task->board->team);
    }
}
