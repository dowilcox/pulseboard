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
        $tasks = Task::query()
            ->whereNotNull('recurrence_config')
            ->whereNotNull('recurrence_next_at')
            ->where('recurrence_next_at', '<=', now())
            ->get();

        $created = 0;

        foreach ($tasks as $task) {
            try {
                DB::transaction(function () use ($task, &$created) {
                    $this->createRecurringTask($task);
                    $this->advanceNextRecurrence($task);
                    $created++;
                });
            } catch (\Throwable $e) {
                $this->error("Failed to process recurring task {$task->id}: {$e->getMessage()}");
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
        $interval = $config['interval'] ?? 1;

        $next = match ($config['frequency'] ?? null) {
            'daily' => $task->recurrence_next_at->addDays($interval),
            'weekly' => $task->recurrence_next_at->addWeeks($interval),
            'monthly' => $task->recurrence_next_at->addMonths($interval),
            'custom' => $task->recurrence_next_at->addDays($interval),
            default => null,
        };

        $task->update(['recurrence_next_at' => $next]);
    }
}
