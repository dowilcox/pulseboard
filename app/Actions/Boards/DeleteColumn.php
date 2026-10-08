<?php

namespace App\Actions\Boards;

use App\Models\Column;
use App\Models\Task;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Lorisleiva\Actions\Concerns\AsAction;

class DeleteColumn
{
    use AsAction;

    /**
     * Delete the given column.
     *
     * If a target column is provided, the column's tasks are appended to the
     * end of it (keeping their relative order); otherwise they are deleted.
     * Cannot delete the last column on a board.
     *
     * @throws ValidationException
     */
    public function handle(Column $column, ?Column $targetColumn = null): void
    {
        $board = $column->board;

        if ($board->columns()->count() <= 1) {
            throw ValidationException::withMessages([
                'column' => ['Cannot delete the last column on a board.'],
            ]);
        }

        DB::transaction(function () use ($column, $targetColumn) {
            if ($targetColumn !== null) {
                $this->moveTasks($column, $targetColumn);
            } else {
                // Delete tasks via Eloquent to trigger media library cleanup
                $column->tasks()->each(fn ($task) => $task->delete());
            }

            $column->delete();
        });
    }

    /**
     * Append every task in $from to the end of $to, preserving their relative
     * order and keeping completion in sync with Done columns (as MoveTask does).
     */
    private function moveTasks(Column $from, Column $to): void
    {
        $nextSort = (float) (Task::where('column_id', $to->id)->max('sort_order') ?? 0);

        $tasks = Task::where('column_id', $from->id)
            ->orderBy('sort_order')
            ->orderBy('created_at')
            ->get(['id', 'completed_at']);

        foreach ($tasks as $task) {
            $nextSort += 1;

            $attributes = [
                'column_id' => $to->id,
                'sort_order' => $nextSort,
            ];

            if ($to->is_done_column && $task->completed_at === null) {
                $attributes['completed_at'] = now();
            } elseif (! $to->is_done_column && $from->is_done_column && $task->completed_at !== null) {
                $attributes['completed_at'] = null;
            }

            Task::whereKey($task->id)->update($attributes);
        }
    }
}
