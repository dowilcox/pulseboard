<?php

namespace App\Actions\Tasks;

use App\Models\Board;
use App\Models\Column;
use App\Models\Task;
use App\Models\User;
use App\Services\ActivityLogger;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Lorisleiva\Actions\Concerns\AsAction;

class CreateTask
{
    use AsAction;

    public function handle(Board $board, Column $column, array $data, User $creator): Task
    {
        $task = DB::transaction(function () use ($board, $column, $data, $creator) {
            if ($column->wip_limit !== null && $column->wip_limit > 0) {
                $currentCount = Task::where('column_id', $column->id)->lockForUpdate()->count();
                if ($currentCount >= $column->wip_limit) {
                    throw ValidationException::withMessages([
                        'column_id' => "Column \"{$column->name}\" has reached its WIP limit of {$column->wip_limit}.",
                    ]);
                }
            }

            $maxSort = Task::where('column_id', $column->id)->max('sort_order') ?? 0;

            $taskNumber = DB::table('tasks')
                ->where('board_id', $board->id)
                ->lockForUpdate()
                ->max('task_number') ?? 0;

            $task = Task::create([
                'board_id' => $board->id,
                'column_id' => $column->id,
                'task_number' => $taskNumber + 1,
                'title' => $data['title'],
                'description' => $data['description'] ?? null,
                'priority' => $data['priority'] ?? 'none',
                'sort_order' => $maxSort + 1,
                'due_date' => $data['due_date'] ?? null,
                'effort_estimate' => $data['effort_estimate'] ?? null,
                'custom_fields' => $data['custom_fields'] ?? null,
                'parent_task_id' => $data['parent_task_id'] ?? null,
                'created_by' => $creator->id,
            ]);

            if (! empty($data['assignee_ids'])) {
                // Filter out deactivated users
                $data['assignee_ids'] = User::whereIn('id', $data['assignee_ids'])
                    ->whereNull('deactivated_at')
                    ->pluck('id')
                    ->toArray();
            }

            if (! empty($data['assignee_ids'])) {
                $assignees = collect($data['assignee_ids'])->mapWithKeys(fn ($userId) => [
                    $userId => [
                        'assigned_at' => now(),
                        'assigned_by' => $creator->id,
                    ],
                ]);
                $task->assignees()->attach($assignees);
            }

            if (! empty($data['label_ids'])) {
                $task->labels()->attach($data['label_ids']);
            }

            return $task;
        });

        ActivityLogger::log($task, 'created', [], $creator);

        return $task->load(['assignees', 'labels']);
    }
}
