<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Team;
use Illuminate\Http\JsonResponse;
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
            'teams' => $teams,
        ]);
    }

    public function show(Team $team): JsonResponse
    {
        $team->load([
            'members:id,name,email',
            'boards:id,team_id,name,is_archived,created_at',
        ]);

        return response()->json($team);
    }
}
