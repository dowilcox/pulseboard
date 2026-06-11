<?php

namespace App\Actions\Boards;

use App\Models\SavedFilter;
use Lorisleiva\Actions\Concerns\AsAction;

class UpdateSavedFilter
{
    use AsAction;

    /**
     * Update the given saved filter.
     *
     * When the filter becomes the default, any other defaults for the same
     * user and board are unset first.
     *
     * @param  array{name?: string, filter_config?: array, is_default?: bool}  $data
     */
    public function handle(SavedFilter $savedFilter, array $data): SavedFilter
    {
        if ($data['is_default'] ?? false) {
            SavedFilter::where('board_id', $savedFilter->board_id)
                ->where('user_id', $savedFilter->user_id)
                ->where('id', '!=', $savedFilter->id)
                ->update(['is_default' => false]);
        }

        $savedFilter->update($data);

        return $savedFilter;
    }
}
