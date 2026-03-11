<?php

namespace App\Http\Controllers\Admin;

use App\Actions\Teams\AddTeamMember;
use App\Actions\Teams\DeleteTeam;
use App\Actions\Teams\RemoveTeamMember;
use App\Http\Controllers\Controller;
use App\Http\Requests\ConfirmDeleteRequest;
use App\Models\Team;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Redirect;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class TeamController extends Controller
{
    public function index(): Response
    {
        $teams = Team::withCount(['members', 'boards'])
            ->orderBy('name')
            ->get();

        return Inertia::render('Admin/Teams', [
            'adminTeams' => $teams,
        ]);
    }

    public function show(Team $team): JsonResponse
    {
        $team->load([
            'members',
            'boards:id,team_id,name,is_archived,created_at',
        ]);

        return response()->json($team);
    }

    public function searchUsers(Request $request, Team $team): JsonResponse
    {
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
            ->whereNull('deactivated_at')
            ->limit(10)
            ->get(['id', 'name', 'email', 'is_bot']);

        return response()->json($users);
    }

    public function addMember(Request $request, Team $team): JsonResponse
    {
        $validated = $request->validate([
            'user_id' => ['required', 'string', 'exists:users,id'],
            'role' => ['sometimes', 'string', Rule::in(['member', 'admin', 'owner'])],
        ]);

        $user = User::findOrFail($validated['user_id']);
        $role = $validated['role'] ?? 'member';

        AddTeamMember::run($team, $user, $role);

        $team->load('members');

        return response()->json($team->members);
    }

    public function removeMember(Team $team, User $user): JsonResponse
    {
        RemoveTeamMember::run($team, $user);

        $team->load('members');

        return response()->json($team->members);
    }

    public function destroy(ConfirmDeleteRequest $request, Team $team): RedirectResponse
    {
        DeleteTeam::run($team);

        return Redirect::route('admin.teams.index')
            ->with('success', "Team \"{$team->name}\" has been deleted.");
    }
}
