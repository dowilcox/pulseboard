<?php

namespace App\Actions\Tasks;

use App\Events\BoardChanged;
use App\Models\Column;
use App\Models\Task;
use App\Models\User;
use App\Services\ActivityLogger;
use Lorisleiva\Actions\Concerns\AsAction;

class ToggleTaskCompletion
{
    use AsAction;

    public function handle(Task $task, User $user): Task
    {
        $task->completed_at = $task->completed_at ? null : now();
        $task->save();

        ActivityLogger::log($task, $task->completed_at ? 'completed' : 'uncompleted', [], $user);

        // Auto-move to Done column if enabled and task was just completed
        if ($task->completed_at) {
            $task->loadMissing('board');
            $board = $task->board;

            if ($board->setting('auto_move_to_done')) {
                $doneColumn = Column::where('board_id', $board->id)
                    ->where('is_done_column', true)
                    ->orderBy('sort_order')
                    ->first();

                if ($doneColumn && $doneColumn->id !== $task->column_id) {
                    $fromColumn = Column::find($task->column_id);
                    $maxSort = Task::where('column_id', $doneColumn->id)->max('sort_order') ?? 0;

                    $task->column_id = $doneColumn->id;
                    $task->sort_order = $maxSort + 1;
                    $task->save();

                    ActivityLogger::log($task, 'moved', [
                        'from_column' => $fromColumn?->name ?? 'Unknown',
                        'to_column' => $doneColumn->name,
                        'from_column_id' => $fromColumn?->id,
                        'to_column_id' => $doneColumn->id,
                        'auto_moved' => true,
                    ], $user);
                }
            }
        }

        BoardChanged::dispatch(
            boardId: $task->board_id,
            action: $task->completed_at ? 'task.completed' : 'task.uncompleted',
            data: ['task_id' => $task->id],
            userId: $user->id,
        );

        return $task;
    }
}
