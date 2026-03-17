<?php

namespace App\Notifications;

use App\Models\Task;
use Carbon\Carbon;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class TaskOverdueNotification extends Notification
{
    use Queueable;

    public function __construct(public Task $task)
    {
        $this->task->loadMissing('board.team');
    }

    public function via(object $notifiable): array
    {
        $channels = [];

        if ($notifiable->wantsNotification('task_overdue', 'in_app')) {
            $channels[] = 'database';
        }

        // Email is handled by the digest command (notifications:send-emails)

        return $channels;
    }

    public function toDatabase(object $notifiable): array
    {
        $dueFormatted = Carbon::parse($this->task->due_date)->format('M j, Y');

        return [
            'type' => 'task_overdue',
            'task_id' => $this->task->id,
            'task_title' => $this->task->title,
            'board_id' => $this->task->board_id,
            'team_id' => $this->task->board->team_id,
            'team_slug' => $this->task->board->team->slug,
            'board_slug' => $this->task->board->slug,
            'task_slug' => $this->task->slug,
            'due_date' => $this->task->due_date,
            'board_name' => $this->task->board->name,
            'message' => "\"{$this->task->title}\" is overdue (was due {$dueFormatted})",
        ];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $dueFormatted = Carbon::parse($this->task->due_date)->format('M j, Y');
        $url = url(
            "/{$this->task->board->team->slug}/{$this->task->board->slug}",
        );

        return (new MailMessage)
            ->subject("Overdue: {$this->task->title}")
            ->greeting("Hello {$notifiable->name},")
            ->line(
                "Your task \"{$this->task->title}\" was due on {$dueFormatted} and is now overdue.",
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
