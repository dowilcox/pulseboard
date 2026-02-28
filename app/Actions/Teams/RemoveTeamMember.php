<?php

namespace App\Actions\Teams;

use App\Models\Team;
use App\Models\TeamMember;
use App\Models\User;
use Illuminate\Validation\ValidationException;
use Lorisleiva\Actions\Concerns\AsAction;

class RemoveTeamMember
{
    use AsAction;

    /**
     * Remove a user from the given team.
     *
     * @throws ValidationException
     */
    public function handle(Team $team, User $user): void
    {
        $membership = TeamMember::where('team_id', $team->id)
            ->where('user_id', $user->id)
            ->first();

        if (! $membership) {
            throw ValidationException::withMessages([
                'user' => ['This user is not a member of the team.'],
            ]);
        }

        if ($membership->role === 'owner') {
            $ownerCount = TeamMember::where('team_id', $team->id)
                ->where('role', 'owner')
                ->count();

            if ($ownerCount <= 1) {
                throw ValidationException::withMessages([
                    'user' => ['Cannot remove the last owner of the team.'],
                ]);
            }
        }

        $membership->delete();
    }
}
