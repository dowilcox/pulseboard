<?php

namespace App\Actions\Boards;

use App\Models\Board;
use App\Support\UniqueSlug;
use Lorisleiva\Actions\Concerns\AsAction;

class UpdateBoard
{
    use AsAction;

    /**
     * Update the given board's name, description, and optionally slug.
     *
     * @param  array{name?: string, description?: string|null, slug?: string}  $data
     */
    public function handle(Board $board, array $data): Board
    {
        if (isset($data['slug'])) {
            $data['slug'] = UniqueSlug::forBoard($board->team_id, $data['slug'], $board->id);
        } elseif (isset($data['name'])) {
            $data['slug'] = UniqueSlug::forBoard($board->team_id, $data['name'], $board->id);
        }

        $board->update($data);

        return $board->refresh();
    }
}
