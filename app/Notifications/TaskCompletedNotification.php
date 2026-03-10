<?php

namespace App\Notifications;

use App\Models\Task;
use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class TaskCompletedNotification extends Notification
{
    use Queueable;

    public function __construct(public Task $task, public User $completedBy) {}

    public function via(object $notifiable): array
    {
        $channels = [];

        if ($notifiable->wantsNotification('task_completed', 'in_app')) {
            $channels[] = 'database';
        }

        return $channels;
    }

    public function toDatabase(object $notifiable): array
    {
        return [
            'type' => 'task_completed',
            'task_id' => $this->task->id,
            'task_title' => $this->task->title,
            'board_id' => $this->task->board_id,
            'team_id' => $this->task->board->team_id,
            'completed_by_name' => $this->completedBy->name,
            'message' => "{$this->completedBy->name} completed \"{$this->task->title}\"",
        ];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $url = url(
            "/teams/{$this->task->board->team_id}/boards/{$this->task->board_id}",
        );

        return (new MailMessage)
            ->subject("Task Completed: {$this->task->title}")
            ->greeting("Hello {$notifiable->name},")
            ->line(
                "{$this->completedBy->name} completed \"{$this->task->title}\".",
            )
            ->action('View Task', $url)
            ->line('Thank you for using PulseBoard!');
    }

    public function afterCommit(): bool
    {
        return true;
    }
}
