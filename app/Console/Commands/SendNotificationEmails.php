<?php

namespace App\Console\Commands;

use App\Mail\NotificationDigest;
use App\Mail\NotificationEmail;
use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Notifications\DatabaseNotification;
use Illuminate\Support\Facades\Mail;

class SendNotificationEmails extends Command
{
    protected $signature = 'notifications:send-emails';

    protected $description = 'Send pending notification emails (individual or digest)';

    /**
     * Notification types that support email delivery.
     * Maps notification class short names to the user preference key.
     */
    private const EMAIL_TYPES = [
        'task_assigned' => 'task_assigned',
        'task_commented' => 'task_commented',
        'task_mentioned' => 'task_mentioned',
        'task_due_soon' => 'task_due_soon',
        'task_overdue' => 'task_overdue',
        'task_completed' => 'task_completed',
        'task_attachment_added' => 'task_attachment_added',
    ];

    /**
     * If a user has more than this many pending notifications,
     * send a digest instead of individual emails.
     */
    private const DIGEST_THRESHOLD = 3;

    public function handle(): int
    {
        // Find all notifications that haven't been emailed yet,
        // created in the last hour (don't email very old ones).
        $pending = DatabaseNotification::query()
            ->whereNull('emailed_at')
            ->where('created_at', '>=', now()->subHour())
            // Give notifications a 2-minute settling window so rapid
            // changes are naturally batched into a digest.
            ->where('created_at', '<=', now()->subMinutes(2))
            ->orderBy('created_at')
            ->get();

        if ($pending->isEmpty()) {
            $this->info('No pending notifications to email.');

            return Command::SUCCESS;
        }

        // Group by user
        $grouped = $pending->groupBy('notifiable_id');

        $emailsSent = 0;
        $digestsSent = 0;

        foreach ($grouped as $userId => $notifications) {
            $user = User::find($userId);
            if (! $user || $user->deactivated_at) {
                // Mark as emailed so we don't keep processing them
                DatabaseNotification::whereIn(
                    'id',
                    $notifications->pluck('id'),
                )->update(['emailed_at' => now()]);

                continue;
            }

            // Filter to only notifications the user wants via email
            $emailable = $notifications->filter(function ($notification) use (
                $user,
            ) {
                $prefKey = $notification->data['type'] ?? null;

                if (! $prefKey || ! isset(self::EMAIL_TYPES[$prefKey])) {
                    return false;
                }

                return $user->wantsNotification($prefKey, 'email');
            });

            if ($emailable->isEmpty()) {
                // Mark all as emailed even if user doesn't want them
                DatabaseNotification::whereIn(
                    'id',
                    $notifications->pluck('id'),
                )->update(['emailed_at' => now()]);

                continue;
            }

            if ($emailable->count() >= self::DIGEST_THRESHOLD) {
                // Send digest
                Mail::to($user)->queue(
                    new NotificationDigest($user, $emailable),
                );
                $digestsSent++;
            } else {
                // Send individual emails using each notification's toMail()
                foreach ($emailable as $notification) {
                    $this->sendIndividualEmail($user, $notification);
                    $emailsSent++;
                }
            }

            // Mark all user's pending notifications as emailed
            DatabaseNotification::whereIn(
                'id',
                $notifications->pluck('id'),
            )->update(['emailed_at' => now()]);
        }

        $this->info(
            "Sent {$emailsSent} individual email(s) and {$digestsSent} digest(s).",
        );

        return Command::SUCCESS;
    }

    private function sendIndividualEmail(
        User $user,
        DatabaseNotification $notification,
    ): void {
        Mail::to($user)->queue(new NotificationEmail($user, $notification));
    }
}
