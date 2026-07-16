<?php

namespace App\Http\Controllers\Api\V1;

use App\Actions\Boards\CreateColumn;
use App\Actions\Boards\DeleteColumn;
use App\Actions\Boards\ReorderColumns;
use App\Actions\Boards\UpdateColumn;
use App\Http\Controllers\Controller;
use App\Http\Requests\ReorderColumnsRequest;
use App\Http\Requests\StoreColumnRequest;
use App\Http\Requests\UpdateColumnRequest;
use App\Models\Board;
use App\Models\Column;
use App\Models\Team;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ColumnController extends Controller
{
    public function store(StoreColumnRequest $request, Team $team, Board $board): JsonResponse
    {
        $this->authorize('manageColumns', $board);

        $column = CreateColumn::run($board, $request->validated());

        return response()->json(['data' => $column], 201);
    }

    public function update(UpdateColumnRequest $request, Team $team, Board $board, Column $column): JsonResponse
    {
        $this->authorize('manageColumns', $board);
        abort_unless($column->board_id === $board->id, 404);

        $column = UpdateColumn::run($column, $request->validated());

        return response()->json(['data' => $column]);
    }

    /**
     * Sync columns on the board: create, update, reorder, and delete in one call.
     */
    public function reorder(ReorderColumnsRequest $request, Team $team, Board $board): JsonResponse
    {
        $this->authorize('manageColumns', $board);

        $board = ReorderColumns::run($board, $request->validated('columns'));

        return response()->json(['data' => $board]);
    }

    public function destroy(Request $request, Team $team, Board $board, Column $column): JsonResponse
    {
        $this->authorize('manageColumns', $board);
        abort_unless($column->board_id === $board->id, 404);

        $targetColumn = null;
        if ($request->filled('target_column_id')) {
            $targetColumn = $board->columns()->where('id', '!=', $column->id)->findOrFail($request->input('target_column_id'));
        }

        DeleteColumn::run($column, $targetColumn);

        return response()->json(null, 204);
    }
}
