<?php

namespace App\Actions\CustomFields;

use App\Actions\CustomFields\Concerns\ManagesCustomFieldDefinitions;
use App\Models\BoardCustomField;
use App\Support\CustomFieldValues;
use Illuminate\Validation\ValidationException;
use Lorisleiva\Actions\Concerns\AsAction;

class UpdateCustomField
{
    use AsAction;
    use ManagesCustomFieldDefinitions;

    /**
     * Rename a field, toggle "show on card", or edit its select options.
     *
     * A field's type can't change (existing values would no longer fit).
     * Removing a select option clears it from every task on the board.
     *
     * @param  array{name?: string, type?: string, options?: array<int, array<string, mixed>>, show_on_card?: bool}  $data
     *
     * @throws ValidationException
     */
    public function handle(BoardCustomField $field, array $data): BoardCustomField
    {
        $board = $field->board;

        if (array_key_exists('type', $data) && $data['type'] !== $field->type) {
            throw ValidationException::withMessages([
                'type' => ['A field’s type can’t be changed. Delete it and add a new field instead.'],
            ]);
        }

        $attributes = [];

        if (array_key_exists('name', $data)) {
            $attributes['name'] = trim($data['name']);
            $this->assertUniqueName($board, $attributes['name'], $field->id);
        }

        if (array_key_exists('show_on_card', $data)) {
            $attributes['show_on_card'] = (bool) $data['show_on_card'];
        }

        $removedOptionIds = [];

        if ($field->hasOptions() && array_key_exists('options', $data)) {
            $previousIds = $field->optionIds();
            $attributes['options'] = $this->normalizeOptions($data['options'] ?? [], $previousIds);
            $removedOptionIds = array_values(array_diff(
                $previousIds,
                array_column($attributes['options'], 'id'),
            ));
        }

        $field->update($attributes);

        if ($removedOptionIds !== []) {
            CustomFieldValues::purge($board, $field->id, $removedOptionIds);
        }

        $this->broadcastFieldsChanged($board, 'custom_field.updated', ['field_id' => $field->id]);

        return $field->refresh();
    }
}
