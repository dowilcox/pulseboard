<?php

namespace App\Actions\Teams;

use App\Models\Team;
use App\Models\TeamMember;
use App\Models\User;
use Illuminate\Validation\ValidationException;
use Lorisleiva\Actions\Concerns\AsAction;

class UpdateMemberRole
{
    use AsAction;

    /**
     * Update a team member's role.
     *
     * @throws ValidationException
     */
    public function handle(Team $team, User $user, string $role): TeamMember
    {
        $membership = TeamMember::where('team_id', $team->id)
            ->where('user_id', $user->id)
            ->first();

        if (! $membership) {
            throw ValidationException::withMessages([
                'user' => ['This user is not a member of the team.'],
            ]);
        }

        if ($membership->role === 'owner' && $role !== 'owner') {
            $ownerCount = TeamMember::where('team_id', $team->id)
                ->where('role', 'owner')
                ->count();

            if ($ownerCount <= 1) {
                throw ValidationException::withMessages([
                    'role' => ['Cannot change the role of the last owner. Assign another owner first.'],
                ]);
            }
        }

        $membership->update(['role' => $role]);

        return $membership->fresh();
    }
}
