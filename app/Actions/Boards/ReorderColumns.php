<?php

namespace App\Actions\Boards;

use App\Models\Board;
use App\Models\Column;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Lorisleiva\Actions\Concerns\AsAction;

class ReorderColumns
{
    use AsAction;

    /**
     * Sync columns on a board: create, update, reorder, and delete.
     *
     * A removed column (`_destroy`) may carry `move_tasks_to`, the id of a
     * surviving column on the same board; its tasks are appended to the end
     * of that column instead of being deleted. Passing `delete_tasks: false`
     * without a target asserts the column is empty, so a column that gained
     * tasks since the client loaded it is rejected rather than wiped.
     *
     * @param  array<int, array<string, mixed>>  $columnsData  Array of column payloads.
     *
     * @throws ValidationException
     */
    public function handle(Board $board, array $columnsData): Board
    {
        $columnsData = array_values($columnsData);

        // Ensure at least one column survives
        $surviving = collect($columnsData)->filter(fn ($c) => empty($c['_destroy']));
        if ($surviving->isEmpty()) {
            throw ValidationException::withMessages([
                'columns' => ['Cannot delete all columns on a board.'],
            ]);
        }

        $existing = $board->columns()->withCount('tasks')->get()->keyBy('id');
        $destroyedIds = collect($columnsData)
            ->filter(fn ($c) => ! empty($c['id']) && ! empty($c['_destroy']))
            ->pluck('id')
            ->all();

        $this->validateTaskDisposition($columnsData, $existing->all(), $destroyedIds);

        DB::transaction(function () use ($board, $columnsData) {
            // Create and update surviving columns first so a move target's
            // final settings (e.g. is_done_column) apply to moved tasks.
            foreach ($columnsData as $data) {
                if (! empty($data['_destroy'])) {
                    continue;
                }

                $attributes = [
                    'name' => $data['name'],
                    'color' => $data['color'],
                    'wip_limit' => $data['wip_limit'] ?? null,
                    'is_done_column' => $data['is_done_column'] ?? false,
                    'sort_order' => $data['sort_order'],
                ];

                if (! empty($data['id'])) {
                    $board->columns()->where('id', $data['id'])->update($attributes);
                } else {
                    $board->columns()->create($attributes);
                }
            }

            foreach ($columnsData as $data) {
                if (empty($data['id']) || empty($data['_destroy'])) {
                    continue;
                }

                $column = $board->columns()->whereKey($data['id'])->first();

                if (! $column) {
                    continue;
                }

                $target = ! empty($data['move_tasks_to'])
                    ? $board->columns()->whereKey($data['move_tasks_to'])->firstOrFail()
                    : null;

                // Survivors were saved above, so this is never the last column.
                DeleteColumn::run($column, $target);
            }
        });

        return $board->load('columns');
    }

    /**
     * Reject move targets that are not surviving columns on this board, and
     * removals that would silently delete tasks the client did not know about.
     *
     * @param  array<int, array<string, mixed>>  $columnsData
     * @param  array<string, Column>  $existing  Board columns keyed by id, with tasks_count.
     * @param  array<int, string>  $destroyedIds
     *
     * @throws ValidationException
     */
    private function validateTaskDisposition(array $columnsData, array $existing, array $destroyedIds): void
    {
        $errors = [];

        foreach ($columnsData as $index => $data) {
            $id = $data['id'] ?? null;

            if (! $id || empty($data['_destroy']) || ! isset($existing[$id])) {
                continue;
            }

            $targetId = $data['move_tasks_to'] ?? null;

            if ($targetId) {
                if ($targetId === $id || ! isset($existing[$targetId]) || in_array($targetId, $destroyedIds, true)) {
                    $errors["columns.{$index}.move_tasks_to"] = [
                        "Tasks from \"{$existing[$id]->name}\" must move to a column on this board that is not being removed.",
                    ];
                }

                continue;
            }

            $keepTasks = array_key_exists('delete_tasks', $data)
                && ! filter_var($data['delete_tasks'], FILTER_VALIDATE_BOOLEAN);
            $taskCount = (int) $existing[$id]->tasks_count;

            if ($keepTasks && $taskCount > 0) {
                $errors["columns.{$index}.delete_tasks"] = [
                    "\"{$existing[$id]->name}\" now has {$taskCount} ".($taskCount === 1 ? 'task' : 'tasks').'. Reload the page and choose where to move them.',
                ];
            }
        }

        if ($errors !== []) {
            throw ValidationException::withMessages($errors);
        }
    }
}
