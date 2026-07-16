<?php

namespace App\Http\Controllers\Api\V1;

use App\Actions\Boards\ArchiveBoard;
use App\Actions\Boards\CreateBoard;
use App\Actions\Boards\DeleteBoard;
use App\Actions\Boards\UpdateBoard;
use App\Http\Controllers\Controller;
use App\Http\Requests\ConfirmDeleteRequest;
use App\Http\Requests\StoreBoardRequest;
use App\Http\Requests\UpdateBoardRequest;
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

    public function store(StoreBoardRequest $request, Team $team): JsonResponse
    {
        $this->authorize('create', [Board::class, $team]);

        $board = CreateBoard::run($team, $request->validated());

        return response()->json(['data' => $board], 201);
    }

    public function update(UpdateBoardRequest $request, Team $team, Board $board): JsonResponse
    {
        $this->authorize('update', $board);

        $board = UpdateBoard::run($board, $request->validated());

        return response()->json(['data' => $board]);
    }

    public function archive(Team $team, Board $board): JsonResponse
    {
        $this->authorize('delete', $board);

        $board = ArchiveBoard::run($board);

        return response()->json(['data' => $board]);
    }

    public function destroy(ConfirmDeleteRequest $request, Team $team, Board $board): JsonResponse
    {
        $this->authorize('delete', $board);

        DeleteBoard::run($board);

        return response()->json(null, 204);
    }
}
