<?php

namespace App\Notifications;

use App\Models\Task;
use Carbon\Carbon;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class TaskDueSoonNotification extends Notification
{
    use Queueable;

    public function __construct(public Task $task) {}

    public function via(object $notifiable): array
    {
        $channels = [];

        if ($notifiable->wantsNotification('task_due_soon', 'in_app')) {
            $channels[] = 'database';
        }

        // Email is handled by the digest command (notifications:send-emails)

        return $channels;
    }

    public function toDatabase(object $notifiable): array
    {
        $dueFormatted = Carbon::parse($this->task->due_date)->format('M j, Y');

        return [
            'type' => 'task_due_soon',
            'task_id' => $this->task->id,
            'task_title' => $this->task->title,
            'board_id' => $this->task->board_id,
            'team_id' => $this->task->board->team_id,
            'due_date' => $this->task->due_date,
            'board_name' => $this->task->board->name,
            'message' => "\"{$this->task->title}\" is due soon ({$dueFormatted})",
        ];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $dueFormatted = Carbon::parse($this->task->due_date)->format('M j, Y');
        $url = url(
            "/teams/{$this->task->board->team_id}/boards/{$this->task->board_id}",
        );

        return (new MailMessage)
            ->subject("Due Soon: {$this->task->title}")
            ->greeting("Hello {$notifiable->name},")
            ->line(
                "Your task \"{$this->task->title}\" is due on {$dueFormatted}.",
            )
            ->line("Board: {$this->task->board->name}")
            ->action('View Task', $url)
            ->line('Thank you for using PulseBoard!');
    }

    public function afterCommit(): bool
    {
        return true;
    }
}
