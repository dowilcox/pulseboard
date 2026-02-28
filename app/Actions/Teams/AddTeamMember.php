<?php

namespace App\Actions\Teams;

use App\Models\Team;
use App\Models\TeamMember;
use App\Models\User;
use Illuminate\Validation\ValidationException;
use Lorisleiva\Actions\Concerns\AsAction;

class AddTeamMember
{
    use AsAction;

    /**
     * Add a user to the given team with the specified role.
     *
     * @throws ValidationException
     */
    public function handle(Team $team, User $user, string $role = 'member'): TeamMember
    {
        if ($team->hasUser($user)) {
            throw ValidationException::withMessages([
                'email' => ['This user is already a member of the team.'],
            ]);
        }

        return TeamMember::create([
            'team_id' => $team->id,
            'user_id' => $user->id,
            'role' => $role,
        ]);
    }
}
