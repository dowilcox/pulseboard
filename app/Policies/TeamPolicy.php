<?php

namespace App\Policies;

use App\Models\Team;
use App\Models\TeamMember;
use App\Models\User;

class TeamPolicy
{
    /**
     * Determine whether the user can view any teams.
     */
    public function viewAny(User $user): bool
    {
        return true;
    }

    /**
     * Determine whether the user can view the team.
     */
    public function view(User $user, Team $team): bool
    {
        return $team->hasUser($user);
    }

    /**
     * Determine whether the user can create teams.
     */
    public function create(User $user): bool
    {
        return true;
    }

    /**
     * Determine whether the user can update the team.
     */
    public function update(User $user, Team $team): bool
    {
        return $this->isOwnerOrAdmin($user, $team);
    }

    /**
     * Determine whether the user can delete the team.
     */
    public function delete(User $user, Team $team): bool
    {
        return $this->isOwner($user, $team);
    }

    /**
     * Determine whether the user can manage team members.
     */
    public function manageMember(User $user, Team $team): bool
    {
        return $this->isOwnerOrAdmin($user, $team);
    }

    /**
     * Check if the user is an owner of the team.
     */
    private function isOwner(User $user, Team $team): bool
    {
        return TeamMember::where('team_id', $team->id)
            ->where('user_id', $user->id)
            ->where('role', 'owner')
            ->exists();
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
