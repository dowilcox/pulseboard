<?php

namespace App\Console\Commands;

use App\Models\Task;
use App\Notifications\TaskDueSoonNotification;
use Illuminate\Console\Command;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class SendDueDateReminders extends Command
{
    protected $signature = 'tasks:send-due-reminders';

    protected $description = 'Send notifications for tasks due within 24 hours';

    public function handle(): int
    {
        $dueSoon = Task::query()
            ->whereNotNull('due_date')
            ->whereBetween('due_date', [
                Carbon::now()->toDateString(),
                Carbon::now()->addDay()->toDateString(),
            ])
            ->open()
            ->with(['assignees', 'board'])
            ->get();

        if ($dueSoon->isEmpty()) {
            $this->info('Sent 0 due-soon reminders.');

            return Command::SUCCESS;
        }

        // Batch-load recently sent due-soon notifications to avoid N+1
        $alreadySent = DB::table('notifications')
            ->where('type', TaskDueSoonNotification::class)
            ->where('created_at', '>=', Carbon::now()->subDay())
            ->get(['notifiable_id', 'data'])
            ->groupBy('notifiable_id')
            ->map(fn ($notifications) => $notifications->map(
                fn ($n) => json_decode($n->data, true)['task_id'] ?? null
            )->filter()->all());

        $sent = 0;

        foreach ($dueSoon as $task) {
            foreach ($task->assignees as $user) {
                $userSentTaskIds = $alreadySent->get($user->id, []);
                if (in_array($task->id, $userSentTaskIds)) {
                    continue;
                }

                $user->notify(new TaskDueSoonNotification($task));
                $sent++;
            }
        }

        $this->info("Sent {$sent} due-soon reminders.");

        return Command::SUCCESS;
    }
}
