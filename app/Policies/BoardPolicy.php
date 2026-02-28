<?php

namespace App\Policies;

use App\Models\Board;
use App\Models\Team;
use App\Models\TeamMember;
use App\Models\User;

class BoardPolicy
{
    /**
     * Determine whether the user can view the board.
     * Any team member can view boards.
     */
    public function view(User $user, Board $board): bool
    {
        return $this->isTeamMember($user, $board->team);
    }

    /**
     * Determine whether the user can create boards for the team.
     * Any team member can create boards.
     */
    public function create(User $user, Team $team): bool
    {
        return $this->isTeamMember($user, $team);
    }

    /**
     * Determine whether the user can update the board.
     * Only team admins or owners can update boards.
     */
    public function update(User $user, Board $board): bool
    {
        return $this->isOwnerOrAdmin($user, $board->team);
    }

    /**
     * Determine whether the user can delete (archive) the board.
     * Only team admins or owners can delete boards.
     */
    public function delete(User $user, Board $board): bool
    {
        return $this->isOwnerOrAdmin($user, $board->team);
    }

    /**
     * Determine whether the user can manage columns on the board.
     * Only team admins or owners can manage columns.
     */
    public function manageColumns(User $user, Board $board): bool
    {
        return $this->isOwnerOrAdmin($user, $board->team);
    }

    /**
     * Check if the user is a member of the team.
     */
    private function isTeamMember(User $user, Team $team): bool
    {
        return $team->hasUser($user);
    }

    /**
     * Check if the user is an owner or admin of the team.
     */
    private function isOwnerOrAdmin(User $user, Team $team): bool
    {
        return TeamMember::where('team_id', $team->id)
            ->where('user_id', $user->id)
            ->whereIn('role', ['owner', 'admin'])
            ->exists();
    }
}
