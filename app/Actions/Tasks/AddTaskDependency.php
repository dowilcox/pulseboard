<?php

namespace App\Actions\Tasks;

use App\Events\BoardChanged;
use App\Models\Task;
use App\Models\TaskDependency;
use App\Models\User;
use App\Services\ActivityLogger;
use Illuminate\Validation\ValidationException;
use Lorisleiva\Actions\Concerns\AsAction;

class AddTaskDependency
{
    use AsAction;

    public function handle(Task $task, Task $dependsOn, User $user): TaskDependency
    {
        // Circular dependency check via BFS
        $visited = [$task->id];
        $queue = [$dependsOn->id];

        while (! empty($queue)) {
            $currentId = array_shift($queue);

            if ($currentId === $task->id) {
                throw ValidationException::withMessages([
                    'depends_on_task_id' => ['Adding this dependency would create a circular reference.'],
                ]);
            }

            if (in_array($currentId, $visited)) {
                continue;
            }

            $visited[] = $currentId;

            $nextIds = TaskDependency::where('task_id', $currentId)
                ->pluck('depends_on_task_id')
                ->toArray();

            $queue = array_merge($queue, $nextIds);
        }

        $dependency = TaskDependency::create([
            'task_id' => $task->id,
            'depends_on_task_id' => $dependsOn->id,
            'created_by' => $user->id,
        ]);

        ActivityLogger::log($task, 'dependency_added', [
            'depends_on_task_id' => $dependsOn->id,
            'depends_on_title' => $dependsOn->title,
        ], $user);

        BoardChanged::dispatch(
            boardId: $task->board_id,
            action: 'task.dependency_added',
            data: [
                'task_id' => $task->id,
                'depends_on_task_id' => $dependsOn->id,
            ],
            userId: $user->id,
        );

        return $dependency;
    }
}
