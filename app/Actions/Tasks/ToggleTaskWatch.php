<?php

namespace App\Actions\Tasks;

use App\Models\Task;
use App\Models\User;
use Lorisleiva\Actions\Concerns\AsAction;

class ToggleTaskWatch
{
    use AsAction;

    public function handle(Task $task, User $user): bool
    {
        $isWatching = $task->watchers()->where('users.id', $user->id)->exists();

        if ($isWatching) {
            $task->watchers()->detach($user->id);

            return false;
        }

        $task->watchers()->attach($user->id, [
            'created_at' => now(),
        ]);

        return true;
    }
}
