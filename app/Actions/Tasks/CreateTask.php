<?php

namespace App\Actions\Tasks;

use App\Actions\Tasks\Concerns\ManagesTaskPlacement;
use App\Models\Board;
use App\Models\Column;
use App\Models\Label;
use App\Models\Task;
use App\Models\User;
use App\Services\ActivityLogger;
use App\Support\RichTextSanitizer;
use Illuminate\Support\Facades\DB;
use Lorisleiva\Actions\Concerns\AsAction;

class CreateTask
{
    use AsAction;
    use ManagesTaskPlacement;

    public function handle(Board $board, Column $column, array $data, User $creator): Task
    {
        $data = $this->applyDefaultTemplate($board, $data);

        $task = DB::transaction(function () use ($board, $column, $data, $creator) {
            $this->assertWipCapacity($column);

            $maxSort = Task::where('column_id', $column->id)->max('sort_order') ?? 0;

            $task = Task::create([
                'board_id' => $board->id,
                'column_id' => $column->id,
                'task_number' => $this->nextTaskNumber($board),
                'title' => $data['title'],
                'description' => RichTextSanitizer::sanitize($data['description'] ?? null),
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
                // Filter out labels that no longer exist or belong to another team
                // (e.g. stale template label_ids referencing deleted labels)
                $data['label_ids'] = Label::whereIn('id', $data['label_ids'])
                    ->where('team_id', $board->team_id)
                    ->pluck('id')
                    ->toArray();
            }

            if (! empty($data['label_ids'])) {
                $task->labels()->attach($data['label_ids']);
            }

            return $task;
        });

        ActivityLogger::log($task, 'created', [], $creator);

        return $task->load(['assignees', 'labels']);
    }

    /**
     * Merge the board's default task template values under the provided data.
     * Explicitly provided values always win over template defaults.
     */
    private function applyDefaultTemplate(Board $board, array $data): array
    {
        if (! $board->default_task_template_id || ! $board->defaultTaskTemplate) {
            return $data;
        }

        $template = $board->defaultTaskTemplate;

        return array_merge(
            [
                'description' => $template->description_template,
                'priority' => $template->priority,
                'effort_estimate' => $template->effort_estimate,
                'label_ids' => $template->label_ids ?? [],
            ],
            $data,
        );
    }
}
