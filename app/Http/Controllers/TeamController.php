<?php

namespace App\Http\Controllers;

use App\Actions\Teams\CreateTeam;
use App\Actions\Teams\UpdateTeam;
use App\Http\Requests\StoreTeamRequest;
use App\Http\Requests\UpdateTeamRequest;
use App\Models\Team;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Redirect;
use Inertia\Inertia;
use Inertia\Response;

class TeamController extends Controller
{
    /**
     * Display a list of the user's teams.
     */
    public function index(): Response
    {
        $teams = auth()->user()
            ->teams()
            ->withCount(['members', 'boards'])
            ->withPivot('role')
            ->orderBy('name')
            ->get();

        return Inertia::render('Teams/Index', [
            'pageTeams' => $teams,
        ]);
    }

    /**
     * Store a newly created team.
     */
    public function store(StoreTeamRequest $request): RedirectResponse
    {
        $team = CreateTeam::run($request->user(), $request->validated());

        return Redirect::route('teams.show', $team);
    }

    /**
     * Display the team dashboard.
     */
    public function show(Team $team): Response
    {
        $this->authorize('view', $team);

        $team->load(['members', 'boards' => function ($query) {
            $query->active()->orderBy('sort_order');
        }]);

        return Inertia::render('Teams/Show', [
            'team' => $team,
            'members' => $team->members,
            'boards' => $team->boards,
        ]);
    }

    /**
     * Update the specified team.
     */
    public function update(UpdateTeamRequest $request, Team $team): RedirectResponse
    {
        $this->authorize('update', $team);

        UpdateTeam::run($team, $request->validated());

        return Redirect::route('teams.show', $team);
    }

    /**
     * Delete the specified team.
     */
    public function destroy(Team $team): RedirectResponse
    {
        $this->authorize('delete', $team);

        $team->delete();

        return Redirect::route('teams.index');
    }
}
