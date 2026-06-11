<?php

namespace App\Notifications;

use App\Models\Comment;
use App\Models\Task;
use App\Models\User;
use App\Support\NotificationText;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;

class TaskMentionedNotification extends Notification
{
    use Queueable;

    public function __construct(
        public Task $task,
        public User $mentioner,
        public Comment $comment,
    ) {
        $this->task->loadMissing('board.team');
    }

    public function via(object $notifiable): array
    {
        $channels = [];

        if ($notifiable->wantsNotification('task_mentioned', 'in_app')) {
            $channels[] = 'database';
        }

        // Email is handled by the digest command (notifications:send-emails)

        return $channels;
    }

    public function toDatabase(object $notifiable): array
    {
        $summary = "{$this->mentioner->name} mentioned you in \"{$this->task->title}\"";
        $preview = NotificationText::preview($this->comment->body, 80);
        $fullComment = NotificationText::toPlainText($this->comment->body);

        return [
            'type' => 'task_mentioned',
            'task_id' => $this->task->id,
            'task_title' => $this->task->title,
            'board_id' => $this->task->board_id,
            'team_id' => $this->task->board->team_id,
            'team_slug' => $this->task->board->team->slug,
            'board_slug' => $this->task->board->slug,
            'task_slug' => $this->task->slug,
            'mentioner_name' => $this->mentioner->name,
            'comment_preview' => $preview,
            'message' => $preview !== '' ? "{$summary}: {$preview}" : $summary,
            'email_message' => $fullComment !== '' ? "{$summary}: {$fullComment}" : $summary,
        ];
    }

    public function afterCommit(): bool
    {
        return true;
    }
}
