<?php

namespace App\Notifications\Channels;

use Illuminate\Notifications\Channels\DatabaseChannel as BaseDatabaseChannel;
use Illuminate\Notifications\Notification;

/**
 * Laravel's database channel, plus the in_app flag. Registered as the
 * 'database' channel in AppServiceProvider.
 *
 * Notifications that can be email-only (see FollowsNotificationPreferences)
 * decide the flag; everything else is always in-app.
 */
class DatabaseChannel extends BaseDatabaseChannel
{
    protected function buildPayload($notifiable, Notification $notification)
    {
        return parent::buildPayload($notifiable, $notification) + [
            'in_app' => ! method_exists($notification, 'showsInApp')
                || $notification->showsInApp($notifiable),
        ];
    }
}
