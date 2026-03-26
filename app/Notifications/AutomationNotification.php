<?php

namespace App\Notifications;

use App\Models\Task;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;

class AutomationNotification extends Notification
{
    use Queueable;

    public function __construct(
        public Task $task,
        public string $message,
    ) {
        $this->task->loadMissing('board.team');
    }

    public function via(object $notifiable): array
    {
        // Automation notifications are always delivered in-app;
        // they are opt-in by nature (the board admin creates the rule).
        return ['database'];
    }

    public function toDatabase(object $notifiable): array
    {
        return [
            'type' => 'automation',
            'task_id' => $this->task->id,
            'task_title' => $this->task->title,
            'board_id' => $this->task->board_id,
            'team_id' => $this->task->board->team_id,
            'team_slug' => $this->task->board->team->slug,
            'board_slug' => $this->task->board->slug,
            'task_slug' => $this->task->slug,
            'message' => $this->message,
        ];
    }

    public function afterCommit(): bool
    {
        return true;
    }
}
