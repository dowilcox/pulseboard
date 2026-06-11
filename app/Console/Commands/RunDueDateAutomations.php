<?php

namespace App\Console\Commands;

use App\Models\AutomationRule;
use App\Models\Task;
use App\Services\TaskAutomationDispatcher;
use Illuminate\Console\Command;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;

class RunDueDateAutomations extends Command
{
    protected $signature = 'automations:run-due-date';

    protected $description = 'Fire due_date_reached automation triggers for tasks whose due date has arrived';

    public function handle(TaskAutomationDispatcher $dispatcher): int
    {
        // Only consider boards that actually have an active due_date_reached rule
        $boardIds = AutomationRule::query()
            ->where('trigger_type', 'due_date_reached')
            ->where('is_active', true)
            ->pluck('board_id')
            ->unique();

        if ($boardIds->isEmpty()) {
            $this->info('No active due_date_reached automation rules.');

            return Command::SUCCESS;
        }

        $tasks = Task::query()
            ->whereIn('board_id', $boardIds)
            ->whereNotNull('due_date')
            ->where('due_date', '<=', Carbon::now()->toDateString())
            ->whereNull('completed_at')
            ->whereHas('column', fn ($q) => $q->where('is_done_column', false))
            ->with('board')
            ->get();

        $fired = 0;

        foreach ($tasks as $task) {
            // Deduplicate: fire the trigger at most once per task per day.
            $cacheKey = sprintf(
                'automations:due-date-fired:%s:%s',
                $task->id,
                Carbon::today()->toDateString(),
            );

            if (! Cache::add($cacheKey, true, Carbon::now()->addDays(2))) {
                continue;
            }

            $dispatcher->dispatchTrigger($task, 'due_date_reached', [
                'due_date' => $task->due_date?->toDateString(),
            ]);

            $fired++;
        }

        $this->info("Fired due_date_reached automations for {$fired} tasks.");

        return Command::SUCCESS;
    }
}
