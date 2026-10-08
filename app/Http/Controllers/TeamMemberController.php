<?php

namespace App\Http\Controllers;

use App\Actions\Teams\AddTeamMember;
use App\Actions\Teams\RemoveTeamMember;
use App\Actions\Teams\UpdateMemberRole;
use App\Models\Team;
use App\Models\TeamMember;
use App\Models\User;
use Illuminate\Http\JsonResponse;
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
            'user_id' => ['required', 'string', 'exists:users,id'],
            'role' => ['sometimes', 'string', Rule::in(['member', 'admin', 'owner'])],
        ]);

        $user = User::findOrFail($validated['user_id']);
        $role = $validated['role'] ?? 'member';

        // Only owners can add members with the owner role
        if ($role === 'owner') {
            $this->authorize('manageAdmin', $team);
        }

        AddTeamMember::run($team, $user, $role);

        return $this->backToMembers($team)
            ->with('success', "{$user->name} was added to the team as ".$this->roleLabel($role).'.');
    }

    public function search(Request $request, Team $team): JsonResponse
    {
        $this->authorize('manageMember', $team);

        $query = $request->get('q', '');

        if (strlen($query) < 2) {
            return response()->json([]);
        }

        $existingMemberIds = $team->members()->pluck('users.id');

        $users = User::where(function ($q) use ($query) {
            $q->where('name', 'like', "%{$query}%")
                ->orWhere('email', 'like', "%{$query}%");
        })
            ->whereNotIn('id', $existingMemberIds)
            ->where('deactivated_at', null)
            ->limit(10)
            ->get(['id', 'name', 'email', 'is_bot']);

        return response()->json($users);
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

        $who = $user->is(auth()->user()) ? 'You are' : "{$user->name} is";

        return $this->backToMembers($team)
            ->with('success', "{$who} now ".$this->roleLabel($validated['role']).'.');
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

        return $this->backToMembers($team)
            ->with('success', "{$user->name} was removed from the team.");
    }

    /**
     * Member management lives on the Members tab of team settings.
     */
    private function backToMembers(Team $team): RedirectResponse
    {
        return Redirect::route('teams.settings', ['team' => $team, 'tab' => 'members']);
    }

    private function roleLabel(string $role): string
    {
        return match ($role) {
            'owner' => 'an owner',
            'admin' => 'an admin',
            default => 'a member',
        };
    }
}
