<?php

namespace App\Actions\Boards;

use App\Models\Column;
use Illuminate\Validation\ValidationException;
use Lorisleiva\Actions\Concerns\AsAction;

class DeleteColumn
{
    use AsAction;

    /**
     * Delete the given column.
     *
     * If a target column is provided, tasks will be moved to it first (Phase 2).
     * Cannot delete the last column on a board.
     *
     * @throws \Illuminate\Validation\ValidationException
     */
    public function handle(Column $column, ?Column $targetColumn = null): void
    {
        $board = $column->board;

        if ($board->columns()->count() <= 1) {
            throw ValidationException::withMessages([
                'column' => ['Cannot delete the last column on a board.'],
            ]);
        }

        // Move tasks to target column if provided (for Phase 2 when tasks exist).
        if ($targetColumn !== null) {
            $column->tasks()->update(['column_id' => $targetColumn->id]);
        }

        $column->delete();
    }
}
