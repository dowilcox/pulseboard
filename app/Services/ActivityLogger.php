<?php

namespace App\Services;

use App\Events\TaskActivityLogged;
use App\Models\Activity;
use App\Models\Comment;
use App\Models\Task;
use App\Models\User;
use Illuminate\Support\Facades\Auth;

class ActivityLogger
{
    public static function log(
        Task $task,
        string $action,
        array $changes = [],
        ?User $user = null,
    ): Activity {
        $userId = $user?->id ?? Auth::id();
        $actor = $user ?? User::find($userId);

        $activity = Activity::create([
            'task_id' => $task->id,
            'user_id' => $userId,
            'action' => $action,
            'changes' => ! empty($changes) ? $changes : null,
            'created_at' => now(),
        ]);

        event(new TaskActivityLogged(
            task: $task,
            action: $action,
            changes: $changes,
            actor: $actor,
            activity: $activity,
        ));

        return $activity;
    }

    /**
     * Notify users mentioned in a specific comment (used for replies
     * which don't go through the full ActivityLogger::log flow).
     */
    public static function notifyMentionsInComment(
        Task $task,
        Comment $comment,
        User $commenter,
    ): void {
        app(TaskActivityNotifier::class)->notifyMentionsInComment(
            $task,
            $comment,
            $commenter,
        );
    }

    public static function broadcastDatabaseNotification(
        User $user,
        object $notification,
        string $message,
        ?string $type = null,
    ): void {
        app(TaskActivityNotifier::class)->broadcastDatabaseNotification(
            $user,
            $notification,
            $message,
            $type,
        );
    }
}
