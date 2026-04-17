<?php

namespace App\Console\Commands;

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
        $maxSort = Task::where('column_id', $task->column_id)->max('sort_order') ?? 0;

        $taskNumber = DB::table('tasks')
            ->where('board_id', $task->board_id)
            ->lockForUpdate()
            ->max('task_number') ?? 0;

        $newTask = Task::create([
            'board_id' => $task->board_id,
            'column_id' => $task->column_id,
            'task_number' => $taskNumber + 1,
            'title' => $task->title,
            'description' => $task->description,
            'priority' => $task->priority,
            'effort_estimate' => $task->effort_estimate,
            'checklists' => $task->checklists,
            'sort_order' => $maxSort + 1,
            'created_by' => $task->created_by,
        ]);

        // Sync assignees
        $assignees = $task->assignees->mapWithKeys(fn ($user) => [
            $user->id => [
                'assigned_at' => now(),
                'assigned_by' => $task->created_by,
            ],
        ]);

        if ($assignees->isNotEmpty()) {
            $newTask->assignees()->attach($assignees);
        }

        // Sync labels
        $labelIds = $task->labels->pluck('id')->toArray();

        if (! empty($labelIds)) {
            $newTask->labels()->attach($labelIds);
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
