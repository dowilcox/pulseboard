<?php

namespace App\Console\Commands;

use App\Actions\Tasks\CreateTask;
use App\Models\Task;
use App\Support\Recurrence;
use Carbon\CarbonImmutable;
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

                    if ($this->processOccurrence($task)) {
                        $created++;
                    }
                });
            } catch (\Throwable $e) {
                $this->error("Failed to process recurring task {$taskId}: {$e->getMessage()}");
            }
        }

        $this->info("Created {$created} recurring task(s).");

        return self::SUCCESS;
    }

    /**
     * Create the copy for the latest occurrence that has arrived, then
     * schedule the next one after today. A missed run therefore creates at
     * most one copy. Returns false when the schedule had already ended.
     */
    private function processOccurrence(Task $task): bool
    {
        $config = $task->recurrence_config;
        $anchor = Recurrence::anchorFor($task);
        $today = Recurrence::day(now());

        $occurrence = Recurrence::day($task->recurrence_next_at);
        if (! empty($config['end_date']) && $occurrence->gt(Recurrence::day($config['end_date']))) {
            $task->update(['recurrence_next_at' => null]);

            return false;
        }

        while (($next = Recurrence::nextOccurrence($config, $anchor, $occurrence)) && $next->lte($today)) {
            $occurrence = $next;
        }

        $this->createRecurringTask($task, $occurrence);

        // Configs saved before anchors were recorded keep the phase they had.
        if (! $task->due_date && ! isset($config['anchor_date'])) {
            $config['anchor_date'] = $anchor->toDateString();
        }

        // null once the end date has passed: the task stops recurring.
        $task->update([
            'recurrence_config' => $config,
            'recurrence_next_at' => Recurrence::nextOccurrence($config, $anchor, $occurrence->max($today)),
        ]);

        return true;
    }

    private function createRecurringTask(Task $task, CarbonImmutable $occurrence): Task
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
            // The schedule is anchored on the due date, so each copy is due
            // on its own occurrence.
            'due_date' => $task->due_date ? $occurrence->toDateString() : null,
            'assignee_ids' => $task->assignees->pluck('id')->all(),
            'label_ids' => $task->labels->pluck('id')->all(),
        ], $task->creator);

        if ($task->checklists) {
            $newTask->update(['checklists' => $task->checklists]);
        }

        return $newTask;
    }
}
