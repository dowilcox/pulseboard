<?php

namespace App\Actions\Boards;

use App\Models\Board;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Lorisleiva\Actions\Concerns\AsAction;

class ReorderColumns
{
    use AsAction;

    /**
     * Sync columns on a board: create, update, reorder, and delete.
     *
     * @param  array<int, array<string, mixed>>  $columnsData  Array of column payloads.
     */
    public function handle(Board $board, array $columnsData): Board
    {
        // Ensure at least one column survives
        $surviving = collect($columnsData)->filter(fn ($c) => empty($c['_destroy']));
        if ($surviving->isEmpty()) {
            throw ValidationException::withMessages([
                'columns' => ['Cannot delete all columns on a board.'],
            ]);
        }

        DB::transaction(function () use ($board, $columnsData) {
            foreach ($columnsData as $data) {
                $id = $data['id'] ?? null;
                $destroy = ! empty($data['_destroy']);

                if ($id && $destroy) {
                    // Delete existing column (tasks cascade via FK)
                    $board->columns()->where('id', $id)->delete();

                    continue;
                }

                if ($id) {
                    // Update existing column
                    $board->columns()->where('id', $id)->update([
                        'name' => $data['name'],
                        'color' => $data['color'],
                        'wip_limit' => $data['wip_limit'] ?? null,
                        'is_done_column' => $data['is_done_column'] ?? false,
                        'sort_order' => $data['sort_order'],
                    ]);
                } else {
                    // Create new column
                    $board->columns()->create([
                        'name' => $data['name'],
                        'color' => $data['color'],
                        'wip_limit' => $data['wip_limit'] ?? null,
                        'is_done_column' => $data['is_done_column'] ?? false,
                        'sort_order' => $data['sort_order'],
                    ]);
                }
            }
        });

        return $board->load('columns');
    }
}
