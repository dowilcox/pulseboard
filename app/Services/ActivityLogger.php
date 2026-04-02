<?php

namespace App\Services;

use App\Actions\Automation\ExecuteAutomationRules;
use App\Events\BoardChanged;
use App\Events\NotificationCreated;
use App\Models\Activity;
use App\Models\Comment;
use App\Models\Task;
use App\Models\User;
use App\Notifications\TaskAssignedNotification;
use App\Notifications\TaskAttachmentAddedNotification;
use App\Notifications\TaskCommentedNotification;
use App\Notifications\TaskCompletedNotification;
use App\Notifications\TaskMentionedNotification;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;

class ActivityLogger
{
    public static function log(
        Task $task,
        string $action,
        array $changes = [],
        ?User $user = null,
    ): Activity {
        $userId = $user?->id ?? Auth::id();

        $activity = Activity::create([
            'task_id' => $task->id,
            'user_id' => $userId,
            'action' => $action,
            'changes' => ! empty($changes) ? $changes : null,
            'created_at' => now(),
        ]);

        broadcast(
            new BoardChanged(
                boardId: $task->board_id,
                action: $action,
                data: [
                    'task_id' => $task->id,
                    'changes' => $changes,
                ],
                userId: $userId,
            ),
        )->toOthers();

        static::dispatchNotifications(
            $task,
            $action,
            $changes,
            $user ?? User::find($userId),
        );

        // Execute automation rules
        static::executeAutomationRules($task, $action, $changes);

        return $activity;
    }

    protected static function dispatchNotifications(
        Task $task,
        string $action,
        array $changes,
        ?User $actor,
    ): void {
        if (! $actor) {
            return;
        }

        match ($action) {
            'assigned' => static::notifyAssigned($task, $changes, $actor),
            'commented' => static::notifyCommented($task, $actor),
            'completed' => static::notifyCompleted($task, $actor),
            'attachment_added' => static::notifyAttachmentAdded(
                $task,
                $changes,
                $actor,
            ),
            default => null,
        };
    }

    protected static function notifyAssigned(
        Task $task,
        array $changes,
        User $assigner,
    ): void {
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
        $assignees = $task
            ->assignees()
            ->where('users.id', '!=', $commenter->id)
            ->get();

        foreach ($assignees as $user) {
            $notification = new TaskCommentedNotification(
                $task,
                $commenter,
                $latestComment,
            );
            $user->notify($notification);

            static::broadcastNotification($user, $notification, $task);
        }

        // Notify watchers (excluding commenter and already-notified assignees)
        $alreadyNotified = $assignees->pluck('id')->push($commenter->id)->toArray();
        $watchers = $task->watchers()
            ->whereNotIn('users.id', $alreadyNotified)
            ->get();

        foreach ($watchers as $user) {
            $notification = new TaskCommentedNotification(
                $task,
                $commenter,
                $latestComment,
            );
            $user->notify($notification);

            static::broadcastNotification($user, $notification, $task);
        }

        // Parse @mentions and notify mentioned users
        $alreadyNotified = array_merge($alreadyNotified, $watchers->pluck('id')->toArray());

        $mentionedUsers = MentionParser::findMentionedUsers(
            $latestComment->body,
            $alreadyNotified,
        );

        foreach ($mentionedUsers as $user) {
            $notification = new TaskMentionedNotification(
                $task,
                $commenter,
                $latestComment,
            );
            $user->notify($notification);

            static::broadcastNotification($user, $notification, $task);
        }
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
        $mentionedUsers = MentionParser::findMentionedUsers(
            $comment->body,
            [$commenter->id],
        );

        foreach ($mentionedUsers as $user) {
            $notification = new TaskMentionedNotification(
                $task,
                $commenter,
                $comment,
            );
            $user->notify($notification);

            static::broadcastNotification($user, $notification, $task);
        }
    }

    protected static function notifyCompleted(
        Task $task,
        User $completedBy,
    ): void {
        // Notify assignees and creator (excluding the person who completed it)
        $notifyUserIds = $task
            ->assignees()
            ->where('users.id', '!=', $completedBy->id)
            ->pluck('users.id')
            ->toArray();

        // Also notify the creator if different from completer
        if ($task->created_by && $task->created_by !== $completedBy->id) {
            $notifyUserIds[] = $task->created_by;
        }

        // Also notify watchers
        $watcherIds = $task->watchers()
            ->where('users.id', '!=', $completedBy->id)
            ->pluck('users.id')
            ->toArray();

        $notifyUserIds = array_unique(array_merge($notifyUserIds, $watcherIds));

        $users = User::whereIn('id', $notifyUserIds)->get();

        foreach ($users as $user) {
            $notification = new TaskCompletedNotification($task, $completedBy);
            $user->notify($notification);

            static::broadcastNotification($user, $notification, $task);
        }
    }

    protected static function notifyAttachmentAdded(
        Task $task,
        array $changes,
        User $uploader,
    ): void {
        $filename = $changes['filename'] ?? 'file';

        // Notify assignees (excluding uploader)
        $assignees = $task
            ->assignees()
            ->where('users.id', '!=', $uploader->id)
            ->get();

        foreach ($assignees as $user) {
            $notification = new TaskAttachmentAddedNotification(
                $task,
                $uploader,
                $filename,
            );
            $user->notify($notification);

            static::broadcastNotification($user, $notification, $task);
        }

        // Notify watchers (excluding uploader and already-notified assignees)
        $alreadyNotified = $assignees->pluck('id')->push($uploader->id)->toArray();
        $watchers = $task->watchers()
            ->whereNotIn('users.id', $alreadyNotified)
            ->get();

        foreach ($watchers as $user) {
            $notification = new TaskAttachmentAddedNotification(
                $task,
                $uploader,
                $filename,
            );
            $user->notify($notification);

            static::broadcastNotification($user, $notification, $task);
        }
    }

    protected static function broadcastNotification(
        User $user,
        $notification,
        Task $task,
    ): void {
        $message = match (true) {
            $notification instanceof TaskAssignedNotification => "{$notification->assigner->name} assigned you to \"{$task->title}\"",
            $notification instanceof TaskCommentedNotification => "{$notification->commenter->name} commented on \"{$task->title}\"",
            $notification instanceof TaskMentionedNotification => "{$notification->mentioner->name} mentioned you in \"{$task->title}\"",
            $notification instanceof TaskCompletedNotification => "{$notification->completedBy->name} completed \"{$task->title}\"",
            $notification instanceof TaskAttachmentAddedNotification => "{$notification->uploader->name} added \"{$notification->filename}\" to \"{$task->title}\"",
            default => 'New notification',
        };

        // Get the notification ID from the database
        $dbNotification = $user->notifications()->latest()->first();

        if ($dbNotification) {
            broadcast(
                new NotificationCreated(
                    userId: $user->id,
                    notificationId: $dbNotification->id,
                    type: class_basename($notification),
                    message: $message,
                ),
            );
        }
    }

    protected static function executeAutomationRules(
        Task $task,
        string $action,
        array $changes,
    ): void {
        $triggerMap = [
            'created' => 'task_created',
            'moved' => 'task_moved',
            'assigned' => 'task_assigned',
            'labels_changed' => 'label_added',
            'gitlab_mr_merged' => 'gitlab_mr_merged',
            'completed' => 'task_completed',
            'uncompleted' => 'task_uncompleted',
            'commented' => 'comment_added',
        ];

        $triggers = [];

        if (isset($triggerMap[$action])) {
            $triggers[] = $triggerMap[$action];
        }

        // Field changes may fire additional triggers
        if ($action === 'field_changed' && isset($changes['priority'])) {
            $triggers[] = 'priority_changed';
        }

        if (empty($triggers)) {
            return;
        }

        $context = array_merge($changes, ['task_id' => $task->id]);

        foreach ($triggers as $triggerType) {
            try {
                ExecuteAutomationRules::run(
                    $task->board,
                    $triggerType,
                    $context,
                );
            } catch (\Throwable $e) {
                Log::warning(
                    'Automation execution failed',
                    [
                        'task_id' => $task->id,
                        'trigger' => $triggerType,
                        'error' => $e->getMessage(),
                    ],
                );
            }
        }
    }
}
