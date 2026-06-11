<?php

namespace App\Policies;

use App\Models\Team;
use App\Models\User;
use App\Policies\Concerns\ChecksTeamRoles;

class TeamPolicy
{
    use ChecksTeamRoles;

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
     * Determine whether the user can manage admins and owners.
     */
    public function manageAdmin(User $user, Team $team): bool
    {
        return $this->isOwner($user, $team);
    }
}
