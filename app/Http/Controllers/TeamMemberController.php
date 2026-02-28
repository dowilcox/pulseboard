<?php

namespace App\Http\Controllers;

use App\Actions\Teams\AddTeamMember;
use App\Actions\Teams\RemoveTeamMember;
use App\Actions\Teams\UpdateMemberRole;
use App\Models\Team;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Redirect;
use Illuminate\Validation\Rule;

class TeamMemberController extends Controller
{
    /**
     * Add a member to the team.
     */
    public function store(Request $request, Team $team): RedirectResponse
    {
        $this->authorize('manageMember', $team);

        $validated = $request->validate([
            'email' => ['required', 'email', 'exists:users,email'],
            'role' => ['sometimes', 'string', Rule::in(['member', 'admin', 'owner'])],
        ]);

        $user = User::where('email', $validated['email'])->firstOrFail();
        $role = $validated['role'] ?? 'member';

        AddTeamMember::run($team, $user, $role);

        return Redirect::route('teams.show', $team)
            ->with('success', 'Team member added successfully.');
    }

    /**
     * Update a team member's role.
     */
    public function update(Request $request, Team $team, User $user): RedirectResponse
    {
        $this->authorize('manageMember', $team);

        $validated = $request->validate([
            'role' => ['required', 'string', Rule::in(['member', 'admin', 'owner'])],
        ]);

        UpdateMemberRole::run($team, $user, $validated['role']);

        return Redirect::route('teams.show', $team)
            ->with('success', 'Member role updated successfully.');
    }

    /**
     * Remove a member from the team.
     */
    public function destroy(Team $team, User $user): RedirectResponse
    {
        $this->authorize('manageMember', $team);

        RemoveTeamMember::run($team, $user);

        return Redirect::route('teams.show', $team)
            ->with('success', 'Team member removed successfully.');
    }
}
