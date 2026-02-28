<?php

namespace App\Actions\Tasks;

use App\Events\BoardChanged;
use App\Models\Column;
use App\Models\Task;
use App\Services\ActivityLogger;
use Illuminate\Support\Facades\Auth;
use Lorisleiva\Actions\Concerns\AsAction;

class MoveTask
{
    use AsAction;

    public function handle(Task $task, Column $column, float $sortOrder): Task
    {
        $fromColumn = $task->column;

        $task->update([
            'column_id' => $column->id,
            'sort_order' => $sortOrder,
        ]);

        if ($fromColumn->id !== $column->id) {
            ActivityLogger::log($task, 'moved', [
                'from_column' => $fromColumn->name,
                'to_column' => $column->name,
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
