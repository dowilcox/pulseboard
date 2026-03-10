<?php

namespace App\Notifications;

use App\Models\Task;
use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class TaskAttachmentAddedNotification extends Notification
{
    use Queueable;

    public function __construct(
        public Task $task,
        public User $uploader,
        public string $filename,
    ) {}

    public function via(object $notifiable): array
    {
        $channels = [];

        if ($notifiable->wantsNotification('task_attachment_added', 'in_app')) {
            $channels[] = 'database';
        }

        return $channels;
    }

    public function toDatabase(object $notifiable): array
    {
        return [
            'type' => 'task_attachment_added',
            'task_id' => $this->task->id,
            'task_title' => $this->task->title,
            'board_id' => $this->task->board_id,
            'team_id' => $this->task->board->team_id,
            'uploader_name' => $this->uploader->name,
            'filename' => $this->filename,
            'message' => "{$this->uploader->name} added \"{$this->filename}\" to \"{$this->task->title}\"",
        ];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $url = url(
            "/teams/{$this->task->board->team_id}/boards/{$this->task->board_id}",
        );

        return (new MailMessage)
            ->subject("Attachment Added: {$this->task->title}")
            ->greeting("Hello {$notifiable->name},")
            ->line(
                "{$this->uploader->name} added \"{$this->filename}\" to \"{$this->task->title}\".",
            )
            ->action('View Task', $url)
            ->line('Thank you for using PulseBoard!');
    }

    public function afterCommit(): bool
    {
        return true;
    }
}
