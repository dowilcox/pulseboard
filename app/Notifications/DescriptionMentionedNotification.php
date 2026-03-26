<?php

namespace App\Notifications;

use App\Models\Task;
use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class DescriptionMentionedNotification extends Notification
{
    use Queueable;

    public function __construct(
        public Task $task,
        public User $mentioner,
    ) {
        $this->task->loadMissing('board.team');
    }

    public function via(object $notifiable): array
    {
        $channels = [];

        if ($notifiable->wantsNotification('task_mentioned', 'in_app')) {
            $channels[] = 'database';
        }

        return $channels;
    }

    public function toDatabase(object $notifiable): array
    {
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
            'message' => "{$this->mentioner->name} mentioned you in the description of \"{$this->task->title}\"",
        ];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $url = url(
            "/{$this->task->board->team->slug}/{$this->task->board->slug}/tasks/{$this->task->slug}",
        );

        return (new MailMessage)
            ->subject("You were mentioned in: {$this->task->title}")
            ->greeting("Hello {$notifiable->name},")
            ->line(
                "{$this->mentioner->name} mentioned you in the description of \"{$this->task->title}\".",
            )
            ->action('View Task', $url)
            ->line('Thank you for using PulseBoard!');
    }

    public function afterCommit(): bool
    {
        return true;
    }
}
