<?php

namespace App\Actions\Tasks\Concerns;

use App\Models\Board;
use App\Models\Column;
use App\Models\Task;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Shared placement helpers for actions that insert tasks into columns and
 * boards. Both helpers take row locks to guard against concurrent inserts,
 * so they must be called inside a database transaction.
 */
trait ManagesTaskPlacement
{
    /**
     * Assert the column has WIP capacity for one more task.
     *
     * @throws ValidationException
     */
    protected function assertWipCapacity(Column $column): void
    {
        if ($column->wip_limit === null || $column->wip_limit <= 0) {
            return;
        }

        Column::whereKey($column->id)->lockForUpdate()->first();
        $currentCount = Task::where('column_id', $column->id)->count();

        if ($currentCount >= $column->wip_limit) {
            throw ValidationException::withMessages([
                'column_id' => "Column \"{$column->name}\" has reached its WIP limit of {$column->wip_limit}.",
            ]);
        }
    }

    /**
     * Reserve the next sequential task number on the board.
     */
    protected function nextTaskNumber(Board $board): int
    {
        $maxTaskNumber = DB::table('tasks')
            ->where('board_id', $board->id)
            ->lockForUpdate()
            ->max('task_number') ?? 0;

        return $maxTaskNumber + 1;
    }
}
