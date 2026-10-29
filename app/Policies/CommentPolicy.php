<?php

namespace App\Policies;

use App\Models\Comment;
use App\Models\Task;
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

        return $this->deleteAny($user, $comment->task);
    }

    /**
     * Whether the user may delete anyone's comments on the task (team owners
     * and admins). Shared with the task page so it shows delete buttons for
     * exactly the comments this policy allows.
     */
    public function deleteAny(User $user, Task $task): bool
    {
        return $this->isOwnerOrAdmin($user, $task->board->team);
    }
}
