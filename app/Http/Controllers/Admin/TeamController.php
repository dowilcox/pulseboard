<?php

namespace App\Http\Controllers\Admin;

use App\Actions\Teams\DeleteTeam;
use App\Http\Controllers\Controller;
use App\Http\Requests\ConfirmDeleteRequest;
use App\Models\Team;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Redirect;
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

    public function destroy(ConfirmDeleteRequest $request, Team $team): RedirectResponse
    {
        DeleteTeam::run($team);

        return Redirect::route('admin.teams.index')
            ->with('success', "Team \"{$team->name}\" has been deleted.");
    }
}
