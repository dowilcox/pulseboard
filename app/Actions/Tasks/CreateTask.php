<?php

namespace App\Actions\Tasks;

use App\Models\Board;
use App\Models\Column;
use App\Models\Task;
use App\Models\User;
use App\Services\ActivityLogger;
use Illuminate\Support\Facades\DB;
use Lorisleiva\Actions\Concerns\AsAction;

class CreateTask
{
    use AsAction;

    public function handle(Board $board, Column $column, array $data, User $creator): Task
    {
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
            'created_by' => $creator->id,
        ]);

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

        ActivityLogger::log($task, 'created', [], $creator);

        return $task->load(['assignees', 'labels']);
    }
}
