<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
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

    public function show(Team $team): JsonResponse
    {
        return response()->json(['data' => $team]);
    }

    public function members(Team $team): JsonResponse
    {
        $members = $team->members()->get();

        return response()->json(['data' => $members]);
    }
}
