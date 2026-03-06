<?php

namespace App\Actions\Boards;

use App\Models\Board;
use App\Models\Column;
use Lorisleiva\Actions\Concerns\AsAction;

class CreateColumn
{
    use AsAction;

    /**
     * Add a new column to the given board.
     *
     * @param  array{name: string, color?: string, wip_limit?: int|null, is_done_column?: bool}  $data
     */
    public function handle(Board $board, array $data): Column
    {
        $nextSortOrder = $board->columns()->max('sort_order') + 1;
        $isDone = $data['is_done_column'] ?? false;

        if ($isDone) {
            $board->columns()->update(['is_done_column' => false]);
        }

        return $board->columns()->create([
            'name' => $data['name'],
            'color' => $data['color'] ?? '#6366f1',
            'wip_limit' => $data['wip_limit'] ?? null,
            'is_done_column' => $isDone,
            'sort_order' => $nextSortOrder,
        ]);
    }
}
