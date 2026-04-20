<?php

namespace App\Console\Commands;

use App\Actions\Tasks\CreateTask;
use App\Models\Task;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class ProcessRecurringTasks extends Command
{
    protected $signature = 'tasks:process-recurring';

    protected $description = 'Create new tasks from recurring task configurations';

    public function handle(): int
    {
        $taskIds = Task::query()
            ->whereNotNull('recurrence_config')
            ->whereNotNull('recurrence_next_at')
            ->where('recurrence_next_at', '<=', now())
            ->pluck('id');

        $created = 0;

        foreach ($taskIds as $taskId) {
            try {
                DB::transaction(function () use ($taskId, &$created) {
                    $task = Task::query()
                        ->whereKey($taskId)
                        ->whereNotNull('recurrence_config')
                        ->whereNotNull('recurrence_next_at')
                        ->where('recurrence_next_at', '<=', now())
                        ->lockForUpdate()
                        ->first();

                    if (! $task) {
                        return;
                    }

                    $this->createRecurringTask($task);
                    $this->advanceNextRecurrence($task);
                    $created++;
                });
            } catch (\Throwable $e) {
                $this->error("Failed to process recurring task {$taskId}: {$e->getMessage()}");
            }
        }

        $this->info("Created {$created} recurring task(s).");

        return self::SUCCESS;
    }

    private function createRecurringTask(Task $task): Task
    {
        $task->loadMissing('board', 'column', 'creator', 'assignees', 'labels');

        if (! $task->creator) {
            throw new \RuntimeException("Recurring task {$task->id} has no creator.");
        }

        $newTask = CreateTask::run($task->board, $task->column, [
            'title' => $task->title,
            'description' => $task->description,
            'priority' => $task->priority,
            'effort_estimate' => $task->effort_estimate,
            'assignee_ids' => $task->assignees->pluck('id')->all(),
            'label_ids' => $task->labels->pluck('id')->all(),
        ], $task->creator);

        if ($task->checklists) {
            $newTask->update(['checklists' => $task->checklists]);
        }

        return $newTask;
    }

    private function advanceNextRecurrence(Task $task): void
    {
        $config = $task->recurrence_config;
        $interval = max(1, (int) ($config['interval'] ?? 1));
        $frequency = $config['frequency'] ?? null;

        $next = $task->recurrence_next_at;
        $now = now();
        do {
            $next = match ($frequency) {
                'daily', 'custom' => $next->addDays($interval),
                'weekly' => $next->addWeeks($interval),
                'monthly' => $next->addMonths($interval),
                default => null,
            };
            if ($next === null) {
                break;
            }
        } while ($next <= $now);

        $task->update(['recurrence_next_at' => $next]);
    }
}
