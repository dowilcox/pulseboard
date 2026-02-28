<?php

namespace App\Actions\Tasks;

use App\Models\TaskTemplate;
use App\Models\Team;
use Lorisleiva\Actions\Concerns\AsAction;

class CreateTaskTemplate
{
    use AsAction;

    public function handle(Team $team, array $data): TaskTemplate
    {
        return TaskTemplate::create([
            'team_id' => $team->id,
            'name' => $data['name'],
            'description_template' => $data['description_template'] ?? null,
            'priority' => $data['priority'] ?? 'none',
            'effort_estimate' => $data['effort_estimate'] ?? null,
            'checklists' => $data['checklists'] ?? null,
            'label_ids' => $data['label_ids'] ?? null,
            'created_by' => $data['created_by'],
        ]);
    }
}
