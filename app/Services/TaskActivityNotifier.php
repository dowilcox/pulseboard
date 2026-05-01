<?php

namespace App\Services;

use App\Events\NotificationCreated;
use App\Models\Comment;
use App\Models\Task;
use App\Models\User;
use App\Notifications\TaskAssignedNotification;
use App\Notifications\TaskAttachmentAddedNotification;
use App\Notifications\TaskCommentedNotification;
use App\Notifications\TaskCommentReplyNotification;
use App\Notifications\TaskCompletedNotification;
use App\Notifications\TaskMentionedNotification;

class TaskActivityNotifier
{
    public function dispatchActivityNotifications(
        Task $task,
        string $action,
        array $changes,
        ?User $actor,
    ): void {
        if (! $actor) {
            return;
        }

        match ($action) {
            'assigned' => $this->notifyAssigned($task, $changes, $actor),
            'commented' => $this->notifyCommented($task, $changes, $actor),
            'completed' => $this->notifyCompleted($task, $actor),
            'attachment_added' => $this->notifyAttachmentAdded(
                $task,
                $changes,
                $actor,
            ),
            default => null,
        };
    }

    public function notifyMentionsInComment(
        Task $task,
        Comment $comment,
        User $commenter,
        array $excludedUserIds = [],
    ): void {
        $mentionedUsers = MentionParser::findMentionedUsers(
            $comment->body,
            array_values(array_unique([...$excludedUserIds, $commenter->id])),
            $task->board->team,
        );

        foreach ($mentionedUsers as $user) {
            $notification = new TaskMentionedNotification(
                $task,
                $commenter,
                $comment,
            );
            $user->notify($notification);

            $this->broadcastNotification($user, $notification, $task);
        }
    }

    public function notifyCommentReply(
        Task $task,
        Comment $reply,
        Comment $parentComment,
        User $replier,
    ): void {
        $recipientIds = collect([$parentComment->user_id])
            ->merge(
                $parentComment->replies()
                    ->where('user_id', '!=', $replier->id)
                    ->pluck('user_id'),
            )
            ->filter(fn (?string $userId): bool => $userId !== null && $userId !== $replier->id)
            ->unique()
            ->values();

        $recipients = User::whereIn('id', $recipientIds)->get()->keyBy('id');
        $alreadyNotified = [$replier->id];

        foreach ($recipientIds as $recipientId) {
            $recipient = $recipients->get($recipientId);

            if (! $recipient) {
                continue;
            }

            $notification = new TaskCommentReplyNotification(
                $task,
                $replier,
                $reply,
                $parentComment,
            );
            $recipient->notify($notification);

            $this->broadcastNotification($recipient, $notification, $task);
            $alreadyNotified[] = $recipient->id;
        }

        $this->notifyMentionsInComment(
            $task,
            $reply,
            $replier,
            $alreadyNotified,
        );
    }

    public function broadcastDatabaseNotification(
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

    private function notifyAssigned(
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

            $this->broadcastNotification($user, $notification, $task);
        }
    }

    private function notifyCommented(
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

            $this->broadcastNotification($user, $notification, $task);
        }

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

            $this->broadcastNotification($user, $notification, $task);
        }

        $alreadyNotified = array_merge(
            $alreadyNotified,
            $watchers->pluck('id')->toArray(),
        );

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

            $this->broadcastNotification($user, $notification, $task);
        }
    }

    private function notifyCompleted(Task $task, User $completedBy): void
    {
        $notifyUserIds = $task
            ->assignees()
            ->where('users.id', '!=', $completedBy->id)
            ->pluck('users.id')
            ->toArray();

        if ($task->created_by && $task->created_by !== $completedBy->id) {
            $notifyUserIds[] = $task->created_by;
        }

        $watcherIds = $task->watchers()
            ->where('users.id', '!=', $completedBy->id)
            ->pluck('users.id')
            ->toArray();

        $users = User::whereIn(
            'id',
            array_unique(array_merge($notifyUserIds, $watcherIds)),
        )->get();

        foreach ($users as $user) {
            $notification = new TaskCompletedNotification($task, $completedBy);
            $user->notify($notification);

            $this->broadcastNotification($user, $notification, $task);
        }
    }

    private function notifyAttachmentAdded(
        Task $task,
        array $changes,
        User $uploader,
    ): void {
        $filename = $changes['filename'] ?? 'file';

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

            $this->broadcastNotification($user, $notification, $task);
        }

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

            $this->broadcastNotification($user, $notification, $task);
        }
    }

    private function broadcastNotification(
        User $user,
        object $notification,
        Task $task,
    ): void {
        $message = match (true) {
            $notification instanceof TaskAssignedNotification => "{$notification->assigner->name} assigned you to \"{$task->title}\"",
            $notification instanceof TaskCommentedNotification => "{$notification->commenter->name} commented on \"{$task->title}\"",
            $notification instanceof TaskCommentReplyNotification => $notification->summaryFor($user),
            $notification instanceof TaskMentionedNotification => "{$notification->mentioner->name} mentioned you in \"{$task->title}\"",
            $notification instanceof TaskCompletedNotification => "{$notification->completedBy->name} completed \"{$task->title}\"",
            $notification instanceof TaskAttachmentAddedNotification => "{$notification->uploader->name} added \"{$notification->filename}\" to \"{$task->title}\"",
            default => 'New notification',
        };

        $this->broadcastDatabaseNotification(
            $user,
            $notification,
            $message,
        );
    }
}
