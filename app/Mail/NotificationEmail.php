<?php

namespace App\Mail;

use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Notifications\DatabaseNotification;
use Illuminate\Queue\SerializesModels;

class NotificationEmail extends Mailable
{
    use Queueable, SerializesModels;

    public string $notificationMessage;

    public string $taskTitle;

    public string $actionUrl;

    public function __construct(
        public User $user,
        public DatabaseNotification $notification,
    ) {
        $data = $notification->data;
        $this->notificationMessage = $data['message'] ?? 'New notification';
        $this->taskTitle = $data['task_title'] ?? 'Task';

        $teamId = $data['team_id'] ?? '';
        $boardId = $data['board_id'] ?? '';
        $this->actionUrl =
            $teamId && $boardId
                ? url("/teams/{$teamId}/boards/{$boardId}")
                : config('app.url');
    }

    public function envelope(): Envelope
    {
        $data = $this->notification->data;

        $subject = match ($data['type'] ?? '') {
            'task_assigned' => "Task Assigned: {$this->taskTitle}",
            'task_commented' => "New Comment on: {$this->taskTitle}",
            'task_mentioned' => "You were mentioned in: {$this->taskTitle}",
            'task_due_soon' => "Due Soon: {$this->taskTitle}",
            'task_overdue' => "Overdue: {$this->taskTitle}",
            'task_completed' => "Task Completed: {$this->taskTitle}",
            'task_attachment_added' => "Attachment Added: {$this->taskTitle}",
            default => 'PulseBoard Notification',
        };

        return new Envelope(subject: $subject);
    }

    public function content(): Content
    {
        return new Content(
            markdown: 'mail.notification-single',
            with: [
                'user' => $this->user,
                'message' => $this->notificationMessage,
                'actionUrl' => $this->actionUrl,
            ],
        );
    }
}
