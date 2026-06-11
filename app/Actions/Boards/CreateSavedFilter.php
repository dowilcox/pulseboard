<?php

namespace App\Actions\Boards;

use App\Models\Board;
use App\Models\SavedFilter;
use App\Models\User;
use Lorisleiva\Actions\Concerns\AsAction;

class CreateSavedFilter
{
    use AsAction;

    /**
     * Create a saved filter for the user on the given board.
     *
     * When the new filter is marked as default, any existing defaults for the
     * same user and board are unset first.
     *
     * @param  array{name: string, filter_config: array, is_default?: bool}  $data
     */
    public function handle(Board $board, User $user, array $data): SavedFilter
    {
        if ($data['is_default'] ?? false) {
            SavedFilter::where('board_id', $board->id)
                ->where('user_id', $user->id)
                ->update(['is_default' => false]);
        }

        return SavedFilter::create([
            'board_id' => $board->id,
            'user_id' => $user->id,
            'name' => $data['name'],
            'filter_config' => $data['filter_config'],
            'is_default' => $data['is_default'] ?? false,
        ]);
    }
}
