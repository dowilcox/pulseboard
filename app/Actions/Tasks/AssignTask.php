<?php

namespace App\Actions\Tasks;

use App\Models\Task;
use App\Models\User;
use App\Services\ActivityLogger;
use Lorisleiva\Actions\Concerns\AsAction;

class AssignTask
{
    use AsAction;

    public function handle(Task $task, array $userIds, User $assigner): Task
    {
        $currentIds = $task->assignees()->pluck('users.id')->toArray();

        $added = array_diff($userIds, $currentIds);
        $removed = array_diff($currentIds, $userIds);

        if (! empty($added)) {
            $attachData = collect($added)->mapWithKeys(fn ($userId) => [
                $userId => [
                    'assigned_at' => now(),
                    'assigned_by' => $assigner->id,
                ],
            ]);
            $task->assignees()->attach($attachData);
        }

        if (! empty($removed)) {
            $task->assignees()->detach($removed);
        }

        if (! empty($added)) {
            $addedNames = User::whereIn('id', $added)->pluck('name')->toArray();
            ActivityLogger::log($task, 'assigned', ['users' => $addedNames], $assigner);
        }

        if (! empty($removed)) {
            $removedNames = User::whereIn('id', $removed)->pluck('name')->toArray();
            ActivityLogger::log($task, 'unassigned', ['users' => $removedNames], $assigner);
        }

        return $task->load('assignees');
    }
}
