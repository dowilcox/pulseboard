<?php

namespace App\Mail;

use App\Models\User;
use App\Support\NotificationText;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Collection;

class NotificationDigest extends Mailable
{
    use Queueable, SerializesModels;

    /**
     * @param  Collection  $notifications  The grouped notification records
     */
    public function __construct(
        public User $user,
        public Collection $notifications,
    ) {}

    public function envelope(): Envelope
    {
        $count = $this->notifications->count();

        return new Envelope(
            subject: "PulseBoard: You have {$count} new notification".
                ($count !== 1 ? 's' : ''),
        );
    }

    public function content(): Content
    {
        $appUrl = config('app.url');
        $messages = $this->notifications->map(function ($notification): string {
            $message = $notification->data['email_message']
                ?? $notification->data['message']
                ?? 'New notification';

            $plainTextMessage = NotificationText::toPlainText($message);

            return $plainTextMessage !== '' ? $plainTextMessage : 'New notification';
        });

        return new Content(
            markdown: 'mail.notification-digest',
            with: [
                'user' => $this->user,
                'messages' => $messages,
                'notifications' => $this->notifications,
                'appUrl' => $appUrl,
                'appDomain' => parse_url($appUrl, PHP_URL_HOST),
                'notificationSettingsUrl' => $appUrl.'/profile#notifications',
            ],
        );
    }
}
