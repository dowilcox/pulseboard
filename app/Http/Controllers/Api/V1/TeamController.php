<?php

namespace App\Http\Controllers\Api\V1;

use App\Actions\Teams\CreateTeam;
use App\Actions\Teams\DeleteTeam;
use App\Actions\Teams\UpdateTeam;
use App\Http\Controllers\Controller;
use App\Http\Requests\ConfirmDeleteRequest;
use App\Http\Requests\StoreTeamRequest;
use App\Http\Requests\UpdateTeamRequest;
use App\Models\Team;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TeamController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $teams = $request->user()->teams()->get();

        return response()->json(['data' => $teams]);
    }

    public function store(StoreTeamRequest $request): JsonResponse
    {
        $team = CreateTeam::run($request->user(), $request->validated());

        return response()->json(['data' => $team], 201);
    }

    public function show(Team $team): JsonResponse
    {
        return response()->json(['data' => $team]);
    }

    public function update(UpdateTeamRequest $request, Team $team): JsonResponse
    {
        $this->authorize('update', $team);

        $team = UpdateTeam::run($team, $request->validated());

        return response()->json(['data' => $team]);
    }

    public function destroy(ConfirmDeleteRequest $request, Team $team): JsonResponse
    {
        $this->authorize('delete', $team);

        DeleteTeam::run($team);

        return response()->json(null, 204);
    }

    public function members(Team $team): JsonResponse
    {
        $members = $team->members()->get();

        return response()->json(['data' => $members]);
    }
}
