<?php

namespace App\Actions\Tasks;

use App\Events\BoardChanged;
use App\Models\Column;
use App\Models\Task;
use App\Services\ActivityLogger;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\ValidationException;
use Lorisleiva\Actions\Concerns\AsAction;

class MoveTask
{
    use AsAction;

    public function handle(Task $task, Column $column, float $sortOrder): Task
    {
        $fromColumn = $task->column;

        if ($fromColumn->id !== $column->id && $column->wip_limit !== null && $column->wip_limit > 0) {
            $currentCount = $column->tasks()->count();
            if ($currentCount >= $column->wip_limit) {
                throw ValidationException::withMessages([
                    'column_id' => "Column \"{$column->name}\" has reached its WIP limit of {$column->wip_limit}.",
                ]);
            }
        }

        $task->update([
            'column_id' => $column->id,
            'sort_order' => $sortOrder,
        ]);

        if ($fromColumn->id !== $column->id) {
            ActivityLogger::log($task, 'moved', [
                'from_column' => $fromColumn->name,
                'to_column' => $column->name,
                'from_column_id' => $fromColumn->id,
                'to_column_id' => $column->id,
            ]);
        } else {
            // Same-column reorder — no activity log, but still broadcast
            broadcast(new BoardChanged(
                boardId: $task->board_id,
                action: 'task.reordered',
                data: [
                    'task_id' => $task->id,
                    'column_id' => $column->id,
                    'sort_order' => $sortOrder,
                ],
                userId: Auth::id(),
            ))->toOthers();
        }

        return $task->fresh();
    }
}
