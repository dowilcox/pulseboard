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
        $fillable = ['title', 'description', 'priority', 'due_date', 'effort_estimate', 'custom_fields', 'checklists', 'recurrence_config'];
        $changes = [];

        foreach ($fillable as $field) {
            if (array_key_exists($field, $data) && $task->{$field} != $data[$field]) {
                $changes[$field] = [
                    'from' => $task->{$field},
                    'to' => $data[$field],
                ];
            }
        }

        $updateData = array_intersect_key($data, array_flip($fillable));

        // Compute recurrence_next_at when recurrence_config is provided
        if (array_key_exists('recurrence_config', $data)) {
            $updateData['recurrence_next_at'] = $this->computeNextRecurrence($data['recurrence_config']);
        }

        $task->update($updateData);

        if (! empty($changes)) {
            ActivityLogger::log($task, 'field_changed', $changes);
        }

        return $task->fresh();
    }

    private function computeNextRecurrence(?array $config): ?\Carbon\Carbon
    {
        if (! $config || empty($config['frequency'])) {
            return null;
        }

        $interval = $config['interval'] ?? 1;

        return match ($config['frequency']) {
            'daily' => now()->addDays($interval),
            'weekly' => now()->addWeeks($interval),
            'monthly' => now()->addMonths($interval),
            'custom' => now()->addDays($interval),
            default => null,
        };
    }
}
