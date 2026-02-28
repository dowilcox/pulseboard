<?php

namespace App\Actions\Tasks;

use App\Models\Label;
use App\Models\Task;
use App\Services\ActivityLogger;
use Lorisleiva\Actions\Concerns\AsAction;

class SyncTaskLabels
{
    use AsAction;

    public function handle(Task $task, array $labelIds): Task
    {
        $currentIds = $task->labels()->pluck('labels.id')->toArray();

        $task->labels()->sync($labelIds);

        $added = array_diff($labelIds, $currentIds);
        $removed = array_diff($currentIds, $labelIds);

        if (! empty($added) || ! empty($removed)) {
            $changes = [];
            if (! empty($added)) {
                $changes['added'] = Label::whereIn('id', $added)->pluck('name')->toArray();
            }
            if (! empty($removed)) {
                $changes['removed'] = Label::whereIn('id', $removed)->pluck('name')->toArray();
            }
            ActivityLogger::log($task, 'labels_changed', $changes);
        }

        return $task->load('labels');
    }
}
