<?php

namespace App\Notifications;

use App\Models\Task;
use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class TaskAssignedNotification extends Notification
{
    use Queueable;

    public function __construct(
        public Task $task,
        public User $assigner,
    ) {}

    public function via(object $notifiable): array
    {
        $channels = [];

        if ($notifiable->wantsNotification('task_assigned', 'in_app')) {
            $channels[] = 'database';
        }

        if ($notifiable->wantsNotification('task_assigned', 'email')) {
            $channels[] = 'mail';
        }

        return $channels;
    }

    public function toDatabase(object $notifiable): array
    {
        return [
            'type' => 'task_assigned',
            'task_id' => $this->task->id,
            'task_title' => $this->task->title,
            'board_id' => $this->task->board_id,
            'team_id' => $this->task->board->team_id,
            'assigner_name' => $this->assigner->name,
            'message' => "{$this->assigner->name} assigned you to \"{$this->task->title}\"",
        ];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $url = url("/teams/{$this->task->board->team_id}/boards/{$this->task->board_id}");

        return (new MailMessage)
            ->subject("Task Assigned: {$this->task->title}")
            ->greeting("Hello {$notifiable->name},")
            ->line("{$this->assigner->name} assigned you to \"{$this->task->title}\".")
            ->action('View Task', $url)
            ->line('Thank you for using PulseBoard!');
    }

    public function afterCommit(): bool
    {
        return true;
    }
}
