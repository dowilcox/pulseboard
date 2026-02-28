<?php

namespace App\Notifications;

use App\Models\Comment;
use App\Models\Task;
use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class TaskMentionedNotification extends Notification
{
    use Queueable;

    public function __construct(
        public Task $task,
        public User $mentioner,
        public Comment $comment,
    ) {}

    public function via(object $notifiable): array
    {
        $channels = [];

        if ($notifiable->wantsNotification('task_mentioned', 'in_app')) {
            $channels[] = 'database';
        }

        if ($notifiable->wantsNotification('task_mentioned', 'email')) {
            $channels[] = 'mail';
        }

        return $channels;
    }

    public function toDatabase(object $notifiable): array
    {
        $preview = mb_strimwidth($this->comment->body, 0, 80, '...');

        return [
            'type' => 'task_mentioned',
            'task_id' => $this->task->id,
            'task_title' => $this->task->title,
            'board_id' => $this->task->board_id,
            'team_id' => $this->task->board->team_id,
            'mentioner_name' => $this->mentioner->name,
            'comment_preview' => $preview,
            'message' => "{$this->mentioner->name} mentioned you in \"{$this->task->title}\": {$preview}",
        ];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $url = url("/teams/{$this->task->board->team_id}/boards/{$this->task->board_id}");
        $preview = mb_strimwidth($this->comment->body, 0, 200, '...');

        return (new MailMessage)
            ->subject("You were mentioned in: {$this->task->title}")
            ->greeting("Hello {$notifiable->name},")
            ->line("{$this->mentioner->name} mentioned you in \"{$this->task->title}\":")
            ->line("> {$preview}")
            ->action('View Task', $url)
            ->line('Thank you for using PulseBoard!');
    }

    public function afterCommit(): bool
    {
        return true;
    }
}
