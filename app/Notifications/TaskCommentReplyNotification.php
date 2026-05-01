<?php

namespace App\Notifications;

use App\Models\Comment;
use App\Models\Task;
use App\Models\User;
use App\Support\NotificationText;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class TaskCommentReplyNotification extends Notification
{
    use Queueable;

    public function __construct(
        public Task $task,
        public User $replier,
        public Comment $reply,
        public Comment $parentComment,
    ) {
        $this->task->loadMissing('board.team');
    }

    public function via(object $notifiable): array
    {
        $channels = [];

        if ($notifiable->wantsNotification('task_comment_replied', 'in_app')) {
            $channels[] = 'database';
        }

        return $channels;
    }

    public function toDatabase(object $notifiable): array
    {
        $summary = $notifiable instanceof User
            ? $this->summaryFor($notifiable)
            : "{$this->replier->name} replied to your comment on \"{$this->task->title}\"";
        $preview = NotificationText::preview($this->reply->body, 80);
        $fullReply = NotificationText::toPlainText($this->reply->body);

        return [
            'type' => 'task_comment_replied',
            'task_id' => $this->task->id,
            'task_title' => $this->task->title,
            'board_id' => $this->task->board_id,
            'team_id' => $this->task->board->team_id,
            'team_slug' => $this->task->board->team->slug,
            'board_slug' => $this->task->board->slug,
            'task_slug' => $this->task->slug,
            'comment_id' => $this->reply->id,
            'parent_comment_id' => $this->parentComment->id,
            'replier_name' => $this->replier->name,
            'comment_preview' => $preview,
            'message' => $preview !== '' ? "{$summary}: {$preview}" : $summary,
            'email_message' => $fullReply !== '' ? "{$summary}: {$fullReply}" : $summary,
        ];
    }

    public function summaryFor(User $notifiable): string
    {
        if ($notifiable->id === $this->parentComment->user_id) {
            return "{$this->replier->name} replied to your comment on \"{$this->task->title}\"";
        }

        return "{$this->replier->name} replied in a thread you participated in on \"{$this->task->title}\"";
    }

    public function toMail(object $notifiable): MailMessage
    {
        $url = url(
            "/{$this->task->board->team->slug}/{$this->task->board->slug}/tasks/{$this->task->slug}",
        );
        $summary = $notifiable instanceof User
            ? $this->summaryFor($notifiable)
            : "{$this->replier->name} replied to your comment on \"{$this->task->title}\"";
        $replyBody = NotificationText::toPlainText($this->reply->body);

        $mail = (new MailMessage)
            ->subject("New Reply on: {$this->task->title}")
            ->greeting("Hello {$notifiable->name},")
            ->line("{$summary}:")
            ->action('View Task', $url);

        if ($replyBody !== '') {
            $mail->line("> {$replyBody}");
        }

        return $mail->line('Thank you for using PulseBoard!');
    }

    public function afterCommit(): bool
    {
        return true;
    }
}
