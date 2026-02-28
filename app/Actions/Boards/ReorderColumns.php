<?php

namespace App\Actions\Boards;

use App\Models\Board;
use Illuminate\Support\Facades\DB;
use Lorisleiva\Actions\Concerns\AsAction;

class ReorderColumns
{
    use AsAction;

    /**
     * Reorder the columns on a board based on the given ordered array of column IDs.
     *
     * @param  array<int, string>  $columnIds  Ordered array of column UUIDs.
     */
    public function handle(Board $board, array $columnIds): Board
    {
        DB::transaction(function () use ($board, $columnIds) {
            foreach ($columnIds as $index => $columnId) {
                $board->columns()
                    ->where('id', $columnId)
                    ->update(['sort_order' => $index]);
            }
        });

        return $board->load('columns');
    }
}
