<?php

namespace App\Actions\Tasks;

use App\Models\Column;
use App\Models\Task;
use App\Services\ActivityLogger;
use Lorisleiva\Actions\Concerns\AsAction;

class MoveTask
{
    use AsAction;

    public function handle(Task $task, Column $column, float $sortOrder): Task
    {
        $fromColumn = $task->column;

        $task->update([
            'column_id' => $column->id,
            'sort_order' => $sortOrder,
        ]);

        if ($fromColumn->id !== $column->id) {
            ActivityLogger::log($task, 'moved', [
                'from_column' => $fromColumn->name,
                'to_column' => $column->name,
            ]);
        }

        return $task->fresh();
    }
}
