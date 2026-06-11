<?php

namespace App\Actions\Boards;

use App\Models\Board;
use App\Models\BoardTemplate;
use App\Models\Team;
use Lorisleiva\Actions\Concerns\AsAction;

class CreateBoardFromTemplate
{
    use AsAction;

    /**
     * Create a new board for the given team using the columns defined in the
     * board template. Board creation (including unique slug generation) is
     * delegated to CreateBoard.
     *
     * @param  array{name: string, description?: string|null}  $data
     */
    public function handle(Team $team, BoardTemplate $template, array $data): Board
    {
        $columns = $template->template_data['columns'] ?? [];

        return CreateBoard::run($team, $data, $columns ?: null);
    }
}
