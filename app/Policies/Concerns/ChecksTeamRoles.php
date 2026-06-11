<?php

namespace App\Policies\Concerns;

use App\Models\Team;
use App\Models\TeamMember;
use App\Models\User;

trait ChecksTeamRoles
{
    /**
     * Check if the user is a member of the team.
     */
    protected function isTeamMember(User $user, Team $team): bool
    {
        return $team->hasUser($user);
    }

    /**
     * Check if the user is an owner of the team.
     */
    protected function isOwner(User $user, Team $team): bool
    {
        return TeamMember::where('team_id', $team->id)
            ->where('user_id', $user->id)
            ->where('role', 'owner')
            ->exists();
    }

    /**
     * Check if the user is an owner or admin of the team.
     */
    protected function isOwnerOrAdmin(User $user, Team $team): bool
    {
        return TeamMember::where('team_id', $team->id)
            ->where('user_id', $user->id)
            ->whereIn('role', ['owner', 'admin'])
            ->exists();
    }
}
