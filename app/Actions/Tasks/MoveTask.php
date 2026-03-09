<?php

namespace App\Actions\Tasks;

use App\Events\BoardChanged;
use App\Models\Board;
use App\Models\Column;
use App\Models\Task;
use App\Services\ActivityLogger;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\ValidationException;
use Lorisleiva\Actions\Concerns\AsAction;

class MoveTask
{
    use AsAction;

    public function handle(Task $task, Column $column, float $sortOrder, ?Board $targetBoard = null): Task
    {
        $fromColumn = $task->column;
        $fromBoard = $task->board;
        $crossBoard = $targetBoard && $targetBoard->id !== $fromBoard->id;

        if ($fromColumn->id !== $column->id && $column->wip_limit !== null && $column->wip_limit > 0) {
            $currentCount = $column->tasks()->count();
            if ($currentCount >= $column->wip_limit) {
                throw ValidationException::withMessages([
                    'column_id' => "Column \"{$column->name}\" has reached its WIP limit of {$column->wip_limit}.",
                ]);
            }
        }

        $updateData = [
            'column_id' => $column->id,
            'sort_order' => $sortOrder,
        ];

        if ($crossBoard) {
            $updateData['board_id'] = $targetBoard->id;

            // Reassign task number for the new board
            $maxTaskNumber = Task::where('board_id', $targetBoard->id)->max('task_number') ?? 0;
            $updateData['task_number'] = $maxTaskNumber + 1;
        }

        $task->update($updateData);

        if ($crossBoard) {
            ActivityLogger::log($task, 'moved', [
                'from_board' => $fromBoard->name,
                'to_board' => $targetBoard->name,
                'from_board_id' => $fromBoard->id,
                'to_board_id' => $targetBoard->id,
                'from_column' => $fromColumn->name,
                'to_column' => $column->name,
                'from_column_id' => $fromColumn->id,
                'to_column_id' => $column->id,
            ]);

            // Broadcast to source board so it removes the task
            broadcast(new BoardChanged(
                boardId: $fromBoard->id,
                action: 'task.deleted',
                data: ['task_id' => $task->id],
                userId: Auth::id(),
            ))->toOthers();
        } elseif ($fromColumn->id !== $column->id) {
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
