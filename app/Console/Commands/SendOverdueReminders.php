<?php

namespace App\Console\Commands;

use App\Models\Task;
use App\Notifications\TaskOverdueNotification;
use Illuminate\Console\Command;
use Illuminate\Support\Carbon;

class SendOverdueReminders extends Command
{
    protected $signature = 'tasks:send-overdue-reminders';

    protected $description = 'Send notifications for overdue tasks';

    public function handle(): int
    {
        $overdue = Task::query()
            ->whereNotNull('due_date')
            ->where('due_date', '<', Carbon::now()->toDateString())
            ->whereHas('column', fn ($q) => $q->where('is_done_column', false))
            ->with(['assignees', 'board'])
            ->get();

        $sent = 0;

        foreach ($overdue as $task) {
            foreach ($task->assignees as $user) {
                // Deduplicate: check if this notification was already sent today
                $alreadySent = $user->notifications()
                    ->where('type', TaskOverdueNotification::class)
                    ->whereJsonContains('data->task_id', $task->id)
                    ->where('created_at', '>=', Carbon::today())
                    ->exists();

                if ($alreadySent) {
                    continue;
                }

                $user->notify(new TaskOverdueNotification($task));
                $sent++;
            }
        }

        $this->info("Sent {$sent} overdue reminders.");

        return Command::SUCCESS;
    }
}
