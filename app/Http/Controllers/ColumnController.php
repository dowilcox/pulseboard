<?php

namespace App\Http\Controllers;

use App\Actions\Boards\CreateColumn;
use App\Actions\Boards\DeleteColumn;
use App\Actions\Boards\ReorderColumns;
use App\Actions\Boards\UpdateColumn;
use App\Http\Requests\ReorderColumnsRequest;
use App\Http\Requests\StoreColumnRequest;
use App\Http\Requests\UpdateColumnRequest;
use App\Models\Board;
use App\Models\Column;
use App\Models\Team;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Redirect;

class ColumnController extends Controller
{
    /**
     * Store a newly created column for the board.
     */
    public function store(StoreColumnRequest $request, Team $team, Board $board): RedirectResponse
    {
        $this->authorize('manageColumns', $board);

        CreateColumn::run($board, $request->validated());

        return Redirect::back();
    }

    /**
     * Update the specified column.
     */
    public function update(UpdateColumnRequest $request, Team $team, Board $board, Column $column): RedirectResponse
    {
        $this->authorize('manageColumns', $board);

        UpdateColumn::run($column, $request->validated());

        return Redirect::back();
    }

    /**
     * Reorder columns on the board.
     */
    public function reorder(ReorderColumnsRequest $request, Team $team, Board $board): RedirectResponse
    {
        $this->authorize('manageColumns', $board);

        ReorderColumns::run($board, $request->validated('column_ids'));

        return Redirect::back();
    }

    /**
     * Delete the specified column.
     */
    public function destroy(Request $request, Team $team, Board $board, Column $column): RedirectResponse
    {
        $this->authorize('manageColumns', $board);

        $targetColumn = null;
        if ($request->filled('target_column_id')) {
            $targetColumn = Column::findOrFail($request->input('target_column_id'));
        }

        DeleteColumn::run($column, $targetColumn);

        return Redirect::back();
    }
}
