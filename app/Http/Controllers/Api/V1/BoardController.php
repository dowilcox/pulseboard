<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Board;
use App\Models\Team;
use Illuminate\Http\JsonResponse;

class BoardController extends Controller
{
    public function index(Team $team): JsonResponse
    {
        $this->authorize('view', $team);

        $boards = $team->boards()
            ->where('is_archived', false)
            ->orderBy('sort_order')
            ->get();

        return response()->json(['data' => $boards]);
    }

    public function show(Team $team, Board $board): JsonResponse
    {
        $this->authorize('view', $board);

        $board->load(['columns' => function ($q) {
            $q->orderBy('sort_order');
        }]);

        return response()->json(['data' => $board]);
    }

    public function labels(Team $team, Board $board): JsonResponse
    {
        $this->authorize('view', $board);

        $labels = $team->labels()->get();

        return response()->json(['data' => $labels]);
    }
}
