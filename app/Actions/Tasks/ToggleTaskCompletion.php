<?php

namespace App\Actions\Tasks;

use App\Events\BoardChanged;
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

        BoardChanged::dispatch(
            boardId: $task->board_id,
            action: $task->completed_at ? 'task.completed' : 'task.uncompleted',
            data: ['task_id' => $task->id],
            userId: $user->id,
        );

        return $task;
    }
}
