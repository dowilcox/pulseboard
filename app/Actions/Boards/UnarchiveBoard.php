<?php

namespace App\Actions\Boards;

use App\Models\Board;
use Lorisleiva\Actions\Concerns\AsAction;

class UnarchiveBoard
{
    use AsAction;

    /**
     * Restore an archived board by setting is_archived back to false. The
     * board keeps its original sort_order, so it returns to its old place.
     */
    public function handle(Board $board): Board
    {
        $board->update(['is_archived' => false]);

        return $board->refresh();
    }
}
