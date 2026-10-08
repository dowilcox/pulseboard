<?php

namespace App\Actions\Tasks;

use App\Models\TaskTemplate;
use Illuminate\Support\Arr;
use Lorisleiva\Actions\Concerns\AsAction;

class UpdateTaskTemplate
{
    use AsAction;

    /**
     * Update the editable fields of a task template. Only keys present in
     * $data are changed.
     *
     * @param  array{name?: string, description_template?: string|null, priority?: string, effort_estimate?: int|null, checklists?: array|null, label_ids?: array|null}  $data
     */
    public function handle(TaskTemplate $template, array $data): TaskTemplate
    {
        $template->update(Arr::only($data, [
            'name',
            'description_template',
            'priority',
            'effort_estimate',
            'checklists',
            'label_ids',
        ]));

        return $template->refresh();
    }
}
