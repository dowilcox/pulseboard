<?php

namespace App\Actions\Tasks;

use App\Models\Task;
use App\Services\ActivityLogger;
use Lorisleiva\Actions\Concerns\AsAction;

class UpdateTask
{
    use AsAction;

    public function handle(Task $task, array $data): Task
    {
        $fillable = ['title', 'description', 'priority', 'due_date', 'effort_estimate', 'custom_fields'];
        $changes = [];

        foreach ($fillable as $field) {
            if (array_key_exists($field, $data) && $task->{$field} != $data[$field]) {
                $changes[$field] = [
                    'from' => $task->{$field},
                    'to' => $data[$field],
                ];
            }
        }

        $task->update(array_intersect_key($data, array_flip($fillable)));

        if (! empty($changes)) {
            ActivityLogger::log($task, 'field_changed', $changes);
        }

        return $task->fresh();
    }
}
