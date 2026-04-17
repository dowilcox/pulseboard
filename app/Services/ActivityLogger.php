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
    private const MAX_AUTOMATION_DEPTH = 3;

    private static int $automationDepth = 0;

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
            'commented' => static::notifyCommented($task, $changes, $actor),
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

    protected static function notifyCommented(
        Task $task,
        array $changes,
        User $commenter,
    ): void {
        $comment = isset($changes['comment_id'])
            ? $task->comments()->find($changes['comment_id'])
            : $task->comments()->latest()->first();

        if (! $comment) {
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
                $comment,
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
                $comment,
            );
            $user->notify($notification);

            static::broadcastNotification($user, $notification, $task);
        }

        // Parse @mentions and notify mentioned users
        $alreadyNotified = array_merge($alreadyNotified, $watchers->pluck('id')->toArray());

        $mentionedUsers = MentionParser::findMentionedUsers(
            $comment->body,
            $alreadyNotified,
            $task->board->team,
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
            $task->board->team,
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

        static::broadcastDatabaseNotification(
            $user,
            $notification,
            $message,
        );
    }

    public static function broadcastDatabaseNotification(
        User $user,
        object $notification,
        string $message,
        ?string $type = null,
    ): void {
        if (
            ! method_exists($notification, 'via')
            || ! in_array('database', $notification->via($user), true)
        ) {
            return;
        }

        $notificationId = $notification->id ?? null;

        if (! $notificationId) {
            return;
        }

        broadcast(
            new NotificationCreated(
                userId: $user->id,
                notificationId: $notificationId,
                type: $type ?? class_basename($notification),
                message: $message,
            ),
        );
    }

    protected static function executeAutomationRules(
        Task $task,
        string $action,
        array $changes,
    ): void {
        if (self::$automationDepth >= self::MAX_AUTOMATION_DEPTH) {
            Log::warning('Automation cascade depth limit reached', [
                'task_id' => $task->id,
                'action' => $action,
                'depth' => self::$automationDepth,
            ]);

            return;
        }

        self::$automationDepth++;

        try {
            static::runAutomationRules($task, $action, $changes);
        } finally {
            self::$automationDepth--;
        }
    }

    protected static function runAutomationRules(
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

        $baseContext = array_merge($changes, ['task_id' => $task->id]);
        $triggerContexts = [];

        if ($action === 'assigned') {
            $userIds = array_values($changes['user_ids'] ?? []);

            if (! empty($userIds)) {
                $triggerContexts['task_assigned'] = array_map(
                    fn (string $userId) => array_merge($baseContext, ['user_id' => $userId]),
                    $userIds,
                );
            }
        } elseif ($action === 'labels_changed') {
            $labelIds = array_values($changes['added_label_ids'] ?? []);

            if (! empty($labelIds)) {
                $triggerContexts['label_added'] = array_map(
                    fn (string $labelId) => array_merge($baseContext, ['label_id' => $labelId]),
                    $labelIds,
                );
            }
        } elseif (isset($triggerMap[$action])) {
            $triggerContexts[$triggerMap[$action]] = [$baseContext];
        }

        if ($action === 'field_changed' && isset($changes['priority'])) {
            $triggerContexts['priority_changed'] = [$baseContext];
        }

        if (empty($triggerContexts)) {
            return;
        }

        foreach ($triggerContexts as $triggerType => $contexts) {
            foreach ($contexts as $context) {
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
}
