<?php

namespace App\Notifications;

use App\Models\Task;
use App\Models\User;
use App\Notifications\Concerns\FollowsNotificationPreferences;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;

class TaskAttachmentAddedNotification extends Notification
{
    use FollowsNotificationPreferences, Queueable;

    public function __construct(
        public Task $task,
        public User $uploader,
        public string $filename,
    ) {
        $this->task->loadMissing('board.team');
    }

    protected function preferenceKey(): string
    {
        return 'task_attachment_added';
    }

    public function toDatabase(object $notifiable): array
    {
        return [
            'type' => 'task_attachment_added',
            'task_id' => $this->task->id,
            'task_title' => $this->task->title,
            'board_id' => $this->task->board_id,
            'team_id' => $this->task->board->team_id,
            'team_slug' => $this->task->board->team->slug,
            'board_slug' => $this->task->board->slug,
            'task_slug' => $this->task->slug,
            'uploader_name' => $this->uploader->name,
            'filename' => $this->filename,
            'message' => "{$this->uploader->name} added \"{$this->filename}\" to \"{$this->task->title}\"",
        ];
    }

    public function afterCommit(): bool
    {
        return true;
    }
}
