<?php

namespace App\Notifications;

use App\Models\Task;
use App\Models\User;
use App\Notifications\Concerns\FollowsNotificationPreferences;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;

class TaskAssignedNotification extends Notification
{
    use FollowsNotificationPreferences, Queueable;

    public function __construct(public Task $task, public User $assigner)
    {
        $this->task->loadMissing('board.team');
    }

    protected function preferenceKey(): string
    {
        return 'task_assigned';
    }

    public function toDatabase(object $notifiable): array
    {
        return [
            'type' => 'task_assigned',
            'task_id' => $this->task->id,
            'task_title' => $this->task->title,
            'board_id' => $this->task->board_id,
            'team_id' => $this->task->board->team_id,
            'team_slug' => $this->task->board->team->slug,
            'board_slug' => $this->task->board->slug,
            'task_slug' => $this->task->slug,
            'assigner_name' => $this->assigner->name,
            'message' => "{$this->assigner->name} assigned you to \"{$this->task->title}\"",
        ];
    }

    public function afterCommit(): bool
    {
        return true;
    }
}
