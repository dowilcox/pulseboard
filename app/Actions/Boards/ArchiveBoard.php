<?php

namespace App\Actions\Boards;

use App\Models\Board;
use Lorisleiva\Actions\Concerns\AsAction;

class ArchiveBoard
{
    use AsAction;

    /**
     * Archive the given board by setting is_archived to true.
     */
    public function handle(Board $board): Board
    {
        $board->update(['is_archived' => true]);

        return $board->refresh();
    }
}
