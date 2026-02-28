<?php

namespace App\Console\Commands;

use App\Models\Task;
use App\Notifications\TaskDueSoonNotification;
use Illuminate\Console\Command;
use Illuminate\Support\Carbon;

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
            ->whereHas('column', fn ($q) => $q->where('is_done_column', false))
            ->with(['assignees', 'board'])
            ->get();

        $sent = 0;

        foreach ($dueSoon as $task) {
            foreach ($task->assignees as $user) {
                // Deduplicate: check if this notification was already sent
                $alreadySent = $user->notifications()
                    ->where('type', TaskDueSoonNotification::class)
                    ->whereJsonContains('data->task_id', $task->id)
                    ->where('created_at', '>=', Carbon::now()->subDay())
                    ->exists();

                if ($alreadySent) {
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
