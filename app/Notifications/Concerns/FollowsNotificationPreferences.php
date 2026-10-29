<?php

namespace App\Notifications\Concerns;

/**
 * Channel selection for notifications with a user preference.
 *
 * A database record is stored when the user wants the type in-app, by
 * email, or both. The email itself is sent later by the batching command
 * (notifications:send-emails) from that record, so email works even with
 * in-app switched off. Email-only records are flagged in_app = false and
 * hidden from the bell (see User::notifications()).
 */
trait FollowsNotificationPreferences
{
    /**
     * The preference key, e.g. 'task_assigned'.
     */
    abstract protected function preferenceKey(): string;

    public function via(object $notifiable): array
    {
        $wanted = $this->showsInApp($notifiable)
            || $notifiable->wantsNotification($this->preferenceKey(), 'email');

        return $wanted ? ['database'] : [];
    }

    public function showsInApp(object $notifiable): bool
    {
        return $notifiable->wantsNotification($this->preferenceKey(), 'in_app');
    }
}
