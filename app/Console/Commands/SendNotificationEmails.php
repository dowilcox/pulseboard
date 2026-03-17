<?php

namespace App\Console\Commands;

use App\Mail\NotificationDigest;
use App\Mail\NotificationEmail;
use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Notifications\DatabaseNotification;
use Illuminate\Support\Facades\Log;
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
        Log::info('[notifications:send-emails] Starting notification email run');

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
            Log::debug('[notifications:send-emails] No pending notifications to email');

            return Command::SUCCESS;
        }

        Log::info("[notifications:send-emails] Found {$pending->count()} pending notification(s)");

        // Group by user
        $grouped = $pending->groupBy('notifiable_id');

        $emailsSent = 0;
        $digestsSent = 0;

        foreach ($grouped as $userId => $notifications) {
            $user = User::find($userId);
            if (! $user || $user->deactivated_at) {
                Log::info("[notifications:send-emails] Skipping user {$userId} (not found or deactivated)");
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
                    Log::debug("[notifications:send-emails] Notification {$notification->id} has unknown type '{$prefKey}', skipping");

                    return false;
                }

                $wants = $user->wantsNotification($prefKey, 'email');
                if (! $wants) {
                    Log::debug("[notifications:send-emails] User {$user->email} opted out of '{$prefKey}' emails");
                }

                return $wants;
            });

            if ($emailable->isEmpty()) {
                Log::info("[notifications:send-emails] No emailable notifications for user {$user->email} ({$notifications->count()} filtered out)");
                // Mark all as emailed even if user doesn't want them
                DatabaseNotification::whereIn(
                    'id',
                    $notifications->pluck('id'),
                )->update(['emailed_at' => now()]);

                continue;
            }

            try {
                if ($emailable->count() >= self::DIGEST_THRESHOLD) {
                    // Send digest
                    Log::info("[notifications:send-emails] Sending digest to {$user->email} ({$emailable->count()} notifications)");
                    Mail::to($user)->send(
                        new NotificationDigest($user, $emailable),
                    );
                    $digestsSent++;
                } else {
                    // Send individual emails
                    foreach ($emailable as $notification) {
                        $type = $notification->data['type'] ?? 'unknown';
                        Log::info("[notifications:send-emails] Sending {$type} email to {$user->email}");
                        Mail::to($user)->send(new NotificationEmail($user, $notification));
                        $emailsSent++;
                    }
                }
            } catch (\Throwable $e) {
                Log::error("[notifications:send-emails] Failed to send email to {$user->email}: {$e->getMessage()}", [
                    'user_id' => $userId,
                    'notification_ids' => $emailable->pluck('id')->toArray(),
                    'exception' => $e,
                ]);

                // Don't mark as emailed so we retry next run
                continue;
            }

            // Mark all user's pending notifications as emailed
            DatabaseNotification::whereIn(
                'id',
                $notifications->pluck('id'),
            )->update(['emailed_at' => now()]);
        }

        Log::info("[notifications:send-emails] Complete: {$emailsSent} email(s), {$digestsSent} digest(s) sent");

        return Command::SUCCESS;
    }
}
