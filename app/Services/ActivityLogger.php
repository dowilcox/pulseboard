<?php

namespace App\Services;

use App\Events\BoardChanged;
use App\Events\NotificationCreated;
use App\Models\Activity;
use App\Models\Task;
use App\Models\User;
use App\Notifications\TaskAssignedNotification;
use App\Notifications\TaskCommentedNotification;
use App\Notifications\TaskMentionedNotification;
use Illuminate\Support\Facades\Auth;

class ActivityLogger
{
    public static function log(Task $task, string $action, array $changes = [], ?User $user = null): Activity
    {
        $userId = $user?->id ?? Auth::id();

        $activity = Activity::create([
            'task_id' => $task->id,
            'user_id' => $userId,
            'action' => $action,
            'changes' => ! empty($changes) ? $changes : null,
            'created_at' => now(),
        ]);

        broadcast(new BoardChanged(
            boardId: $task->board_id,
            action: $action,
            data: [
                'task_id' => $task->id,
                'changes' => $changes,
            ],
            userId: $userId,
        ))->toOthers();

        static::dispatchNotifications($task, $action, $changes, $user ?? User::find($userId));

        // Execute automation rules
        static::executeAutomationRules($task, $action, $changes);

        return $activity;
    }

    protected static function dispatchNotifications(Task $task, string $action, array $changes, ?User $actor): void
    {
        if (! $actor) {
            return;
        }

        match ($action) {
            'assigned' => static::notifyAssigned($task, $changes, $actor),
            'commented' => static::notifyCommented($task, $actor),
            default => null,
        };
    }

    protected static function notifyAssigned(Task $task, array $changes, User $assigner): void
    {
        $assignedUserIds = $changes['user_ids'] ?? [];

        if (empty($assignedUserIds)) {
            return;
        }

        $users = User::whereIn('id', $assignedUserIds)
            ->where('id', '!=', $assigner->id)
            ->get();

        foreach ($users as $user) {
            $notification = new TaskAssignedNotification($task, $assigner);
            $user->notify($notification);

            static::broadcastNotification($user, $notification, $task);
        }
    }

    protected static function notifyCommented(Task $task, User $commenter): void
    {
        $latestComment = $task->comments()->latest()->first();
        if (! $latestComment) {
            return;
        }

        // Notify assignees (excluding commenter)
        $assignees = $task->assignees()
            ->where('users.id', '!=', $commenter->id)
            ->get();

        foreach ($assignees as $user) {
            $notification = new TaskCommentedNotification($task, $commenter, $latestComment);
            $user->notify($notification);

            static::broadcastNotification($user, $notification, $task);
        }

        // Parse @mentions and notify mentioned users
        preg_match_all('/@(\w+)/', $latestComment->body, $matches);
        if (! empty($matches[1])) {
            $mentionedUsers = User::whereIn('name', $matches[1])
                ->where('id', '!=', $commenter->id)
                ->get();

            // Exclude users already notified as assignees
            $alreadyNotified = $assignees->pluck('id')->toArray();

            foreach ($mentionedUsers as $user) {
                if (in_array($user->id, $alreadyNotified)) {
                    continue;
                }

                $notification = new TaskMentionedNotification($task, $commenter, $latestComment);
                $user->notify($notification);

                static::broadcastNotification($user, $notification, $task);
            }
        }
    }

    protected static function broadcastNotification(User $user, $notification, Task $task): void
    {
        $message = match (true) {
            $notification instanceof TaskAssignedNotification => "{$notification->assigner->name} assigned you to \"{$task->title}\"",
            $notification instanceof TaskCommentedNotification => "{$notification->commenter->name} commented on \"{$task->title}\"",
            $notification instanceof TaskMentionedNotification => "{$notification->mentioner->name} mentioned you in \"{$task->title}\"",
            default => 'New notification',
        };

        // Get the notification ID from the database
        $dbNotification = $user->notifications()->latest()->first();

        if ($dbNotification) {
            broadcast(new NotificationCreated(
                userId: $user->id,
                notificationId: $dbNotification->id,
                type: class_basename($notification),
                message: $message,
            ));
        }
    }

    protected static function executeAutomationRules(Task $task, string $action, array $changes): void
    {
        $triggerMap = [
            'created' => 'task_created',
            'moved' => 'task_moved',
            'assigned' => 'task_assigned',
            'labels_changed' => 'label_added',
            'gitlab_mr_merged' => 'gitlab_mr_merged',
        ];

        $triggerType = $triggerMap[$action] ?? null;
        if (! $triggerType) {
            return;
        }

        $context = array_merge($changes, ['task_id' => $task->id]);

        try {
            \App\Actions\Automation\ExecuteAutomationRules::run(
                $task->board,
                $triggerType,
                $context,
            );
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::warning('Automation execution failed', [
                'task_id' => $task->id,
                'trigger' => $triggerType,
                'error' => $e->getMessage(),
            ]);
        }
    }
}
