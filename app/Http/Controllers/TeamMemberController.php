<?php

namespace App\Http\Controllers;

use App\Actions\Teams\AddTeamMember;
use App\Actions\Teams\RemoveTeamMember;
use App\Actions\Teams\UpdateMemberRole;
use App\Models\Team;
use App\Models\TeamMember;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Redirect;
use Illuminate\Validation\Rule;

class TeamMemberController extends Controller
{
    public function store(Request $request, Team $team): RedirectResponse
    {
        $this->authorize('manageMember', $team);

        $validated = $request->validate([
            'email' => ['required', 'email', 'exists:users,email'],
            'role' => ['sometimes', 'string', Rule::in(['member', 'admin', 'owner'])],
        ]);

        $user = User::where('email', $validated['email'])->firstOrFail();
        $role = $validated['role'] ?? 'member';

        // Only owners can add members with the owner role
        if ($role === 'owner') {
            $this->authorize('manageAdmin', $team);
        }

        AddTeamMember::run($team, $user, $role);

        return Redirect::route('teams.settings', $team)
            ->with('success', 'Team member added successfully.');
    }

    public function update(Request $request, Team $team, User $user): RedirectResponse
    {
        $this->authorize('manageMember', $team);

        $validated = $request->validate([
            'role' => ['required', 'string', Rule::in(['member', 'admin', 'owner'])],
        ]);

        // Only owners can modify admins/owners or grant the owner role
        $currentRole = TeamMember::where('team_id', $team->id)
            ->where('user_id', $user->id)
            ->value('role');

        if (in_array($currentRole, ['admin', 'owner']) || $validated['role'] === 'owner') {
            $this->authorize('manageAdmin', $team);
        }

        UpdateMemberRole::run($team, $user, $validated['role']);

        return Redirect::route('teams.settings', $team)
            ->with('success', 'Member role updated successfully.');
    }

    public function destroy(Team $team, User $user): RedirectResponse
    {
        $this->authorize('manageMember', $team);

        // Only owners can remove admins or other owners
        $targetRole = TeamMember::where('team_id', $team->id)
            ->where('user_id', $user->id)
            ->value('role');

        if (in_array($targetRole, ['admin', 'owner'])) {
            $this->authorize('manageAdmin', $team);
        }

        RemoveTeamMember::run($team, $user);

        return Redirect::route('teams.settings', $team)
            ->with('success', 'Team member removed successfully.');
    }
}
