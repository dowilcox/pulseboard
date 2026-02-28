<?php

namespace App\Actions\Tasks;

use App\Models\Column;
use App\Models\Task;
use App\Models\TaskTemplate;
use App\Models\User;
use Lorisleiva\Actions\Concerns\AsAction;

class CreateTaskFromTemplate
{
    use AsAction;

    public function handle(TaskTemplate $template, Column $column, User $creator): Task
    {
        $data = [
            'title' => $template->name,
            'description' => $template->description_template,
            'priority' => $template->priority,
            'effort_estimate' => $template->effort_estimate,
            'label_ids' => $template->label_ids ?? [],
        ];

        $task = CreateTask::run($column->board, $column, $data, $creator);

        if ($template->checklists) {
            $task->update(['checklists' => $template->checklists]);
        }

        return $task->fresh(['assignees', 'labels']);
    }
}
