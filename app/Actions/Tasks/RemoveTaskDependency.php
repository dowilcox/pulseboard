<?php

namespace App\Actions\Tasks;

use App\Events\BoardChanged;
use App\Models\Task;
use App\Models\TaskDependency;
use App\Models\User;
use App\Services\ActivityLogger;
use Lorisleiva\Actions\Concerns\AsAction;

class RemoveTaskDependency
{
    use AsAction;

    public function handle(Task $task, Task $dependsOn, User $user): void
    {
        TaskDependency::where('task_id', $task->id)
            ->where('depends_on_task_id', $dependsOn->id)
            ->delete();

        ActivityLogger::log($task, 'dependency_removed', [
            'depends_on_task_id' => $dependsOn->id,
            'depends_on_title' => $dependsOn->title,
        ], $user);

        BoardChanged::dispatch(
            boardId: $task->board_id,
            action: 'task.dependency_removed',
            data: [
                'task_id' => $task->id,
                'depends_on_task_id' => $dependsOn->id,
            ],
            userId: $user->id,
        );
    }
}
