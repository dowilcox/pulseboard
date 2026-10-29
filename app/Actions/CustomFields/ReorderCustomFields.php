<?php

namespace App\Actions\CustomFields;

use App\Actions\CustomFields\Concerns\ManagesCustomFieldDefinitions;
use App\Models\Board;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Lorisleiva\Actions\Concerns\AsAction;

class ReorderCustomFields
{
    use AsAction;
    use ManagesCustomFieldDefinitions;

    /**
     * Put the board's fields in the given order. Fields missing from the
     * list (e.g. added by someone else meanwhile) keep their relative order
     * after the listed ones.
     *
     * @param  array<int, string>  $fieldIds
     *
     * @throws ValidationException
     */
    public function handle(Board $board, array $fieldIds): Collection
    {
        $fields = $board->customFields()->get()->keyBy('id');
        $fieldIds = array_values(array_unique($fieldIds));

        $unknown = array_diff($fieldIds, $fields->keys()->all());
        if ($unknown !== []) {
            throw ValidationException::withMessages([
                'field_ids' => ['Every id must be a custom field on this board.'],
            ]);
        }

        $order = [...$fieldIds, ...array_values(array_diff($fields->keys()->all(), $fieldIds))];

        DB::transaction(function () use ($order, $fields) {
            foreach ($order as $index => $id) {
                if ($fields[$id]->sort_order !== $index) {
                    $fields[$id]->update(['sort_order' => $index]);
                }
            }
        });

        $this->broadcastFieldsChanged($board, 'custom_field.reordered');

        return $board->customFields()->get();
    }
}
