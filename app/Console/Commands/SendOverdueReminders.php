<?php

namespace App\Console\Commands;

use App\Models\Task;
use App\Notifications\TaskOverdueNotification;
use Illuminate\Console\Command;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

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

        if ($overdue->isEmpty()) {
            $this->info('No overdue tasks found.');

            return Command::SUCCESS;
        }

        // Batch-load today's overdue notifications to avoid N+1
        $alreadySent = DB::table('notifications')
            ->where('type', TaskOverdueNotification::class)
            ->where('created_at', '>=', Carbon::today())
            ->get(['notifiable_id', 'data'])
            ->groupBy('notifiable_id')
            ->map(fn ($notifications) => $notifications->map(
                fn ($n) => json_decode($n->data, true)['task_id'] ?? null
            )->filter()->all());

        $sent = 0;

        foreach ($overdue as $task) {
            foreach ($task->assignees as $user) {
                $userSentTaskIds = $alreadySent->get($user->id, []);
                if (in_array($task->id, $userSentTaskIds)) {
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
