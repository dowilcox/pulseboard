<?php

namespace App\Services;

use App\Models\Activity;
use App\Models\Task;
use App\Models\User;
use Illuminate\Support\Facades\Auth;

class ActivityLogger
{
    public static function log(Task $task, string $action, array $changes = [], ?User $user = null): Activity
    {
        return Activity::create([
            'task_id' => $task->id,
            'user_id' => $user?->id ?? Auth::id(),
            'action' => $action,
            'changes' => ! empty($changes) ? $changes : null,
            'created_at' => now(),
        ]);
    }
}
