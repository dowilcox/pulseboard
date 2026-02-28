<?php

namespace App\Policies;

use App\Models\Board;
use App\Models\Task;
use App\Models\Team;
use App\Models\TeamMember;
use App\Models\User;

class TaskPolicy
{
    /**
     * Any team member can view tasks.
     */
    public function view(User $user, Task $task): bool
    {
        return $this->isTeamMember($user, $task->board->team);
    }

    /**
     * Any team member can create tasks.
     */
    public function create(User $user, Board $board): bool
    {
        return $this->isTeamMember($user, $board->team);
    }

    /**
     * Any team member can update tasks (collaborative).
     */
    public function update(User $user, Task $task): bool
    {
        return $this->isTeamMember($user, $task->board->team);
    }

    /**
     * Task creator, team admin, or owner can delete tasks.
     */
    public function delete(User $user, Task $task): bool
    {
        if ($task->created_by === $user->id) {
            return true;
        }

        return $this->isOwnerOrAdmin($user, $task->board->team);
    }

    /**
     * Any team member can assign tasks.
     */
    public function assign(User $user, Task $task): bool
    {
        return $this->isTeamMember($user, $task->board->team);
    }

    private function isTeamMember(User $user, Team $team): bool
    {
        return $team->hasUser($user);
    }

    private function isOwnerOrAdmin(User $user, Team $team): bool
    {
        return TeamMember::where('team_id', $team->id)
            ->where('user_id', $user->id)
            ->whereIn('role', ['owner', 'admin'])
            ->exists();
    }
}
