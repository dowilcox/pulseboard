<?php

namespace App\Actions\Boards;

use App\Models\Board;
use Lorisleiva\Actions\Concerns\AsAction;

class UpdateBoard
{
    use AsAction;

    /**
     * Update the given board's name and description.
     *
     * @param  array{name?: string, description?: string|null}  $data
     */
    public function handle(Board $board, array $data): Board
    {
        $board->update($data);

        return $board->refresh();
    }
}
