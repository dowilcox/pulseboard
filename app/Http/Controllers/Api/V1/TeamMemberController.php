<?php

namespace App\Http\Controllers\Api\V1;

use App\Actions\Teams\AddTeamMember;
use App\Actions\Teams\RemoveTeamMember;
use App\Actions\Teams\UpdateMemberRole;
use App\Http\Controllers\Controller;
use App\Models\Team;
use App\Models\TeamMember;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class TeamMemberController extends Controller
{
    public function search(Request $request, Team $team): JsonResponse
    {
        $this->authorize('manageMember', $team);

        $query = $request->get('q', '');

        if (strlen($query) < 2) {
            return response()->json(['data' => []]);
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

        return response()->json(['data' => $users]);
    }

    public function store(Request $request, Team $team): JsonResponse
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

        $membership = AddTeamMember::run($team, $user, $role);

        return response()->json(['data' => $membership->load('user')], 201);
    }

    public function update(Request $request, Team $team, User $user): JsonResponse
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

        $membership = UpdateMemberRole::run($team, $user, $validated['role']);

        return response()->json(['data' => $membership->load('user')]);
    }

    public function destroy(Team $team, User $user): JsonResponse
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

        return response()->json(null, 204);
    }
}
