<?php

namespace App\Notifications;

use App\Models\Comment;
use App\Models\Task;
use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class TaskCommentedNotification extends Notification
{
    use Queueable;

    public function __construct(
        public Task $task,
        public User $commenter,
        public Comment $comment,
    ) {}

    public function via(object $notifiable): array
    {
        $channels = [];

        if ($notifiable->wantsNotification('task_commented', 'in_app')) {
            $channels[] = 'database';
        }

        if ($notifiable->wantsNotification('task_commented', 'email')) {
            $channels[] = 'mail';
        }

        return $channels;
    }

    public function toDatabase(object $notifiable): array
    {
        $preview = mb_strimwidth($this->comment->body, 0, 80, '...');

        return [
            'type' => 'task_commented',
            'task_id' => $this->task->id,
            'task_title' => $this->task->title,
            'board_id' => $this->task->board_id,
            'team_id' => $this->task->board->team_id,
            'commenter_name' => $this->commenter->name,
            'comment_preview' => $preview,
            'message' => "{$this->commenter->name} commented on \"{$this->task->title}\": {$preview}",
        ];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $url = url("/teams/{$this->task->board->team_id}/boards/{$this->task->board_id}");
        $preview = mb_strimwidth($this->comment->body, 0, 200, '...');

        return (new MailMessage)
            ->subject("New Comment on: {$this->task->title}")
            ->greeting("Hello {$notifiable->name},")
            ->line("{$this->commenter->name} commented on \"{$this->task->title}\":")
            ->line("> {$preview}")
            ->action('View Task', $url)
            ->line('Thank you for using PulseBoard!');
    }

    public function afterCommit(): bool
    {
        return true;
    }
}
