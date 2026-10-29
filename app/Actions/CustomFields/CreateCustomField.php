<?php

namespace App\Actions\CustomFields;

use App\Actions\CustomFields\Concerns\ManagesCustomFieldDefinitions;
use App\Models\Board;
use App\Models\BoardCustomField;
use Illuminate\Validation\ValidationException;
use Lorisleiva\Actions\Concerns\AsAction;

class CreateCustomField
{
    use AsAction;
    use ManagesCustomFieldDefinitions;

    /**
     * Add a custom field to the end of the board's field list.
     *
     * @param  array{name: string, type: string, options?: array<int, array<string, mixed>>, show_on_card?: bool}  $data
     *
     * @throws ValidationException
     */
    public function handle(Board $board, array $data): BoardCustomField
    {
        if ($board->customFields()->count() >= BoardCustomField::MAX_PER_BOARD) {
            throw ValidationException::withMessages([
                'name' => ['A board can have at most '.BoardCustomField::MAX_PER_BOARD.' custom fields.'],
            ]);
        }

        $name = trim($data['name']);
        $this->assertUniqueName($board, $name);

        $field = $board->customFields()->create([
            'name' => $name,
            'type' => $data['type'],
            'options' => BoardCustomField::typeHasOptions($data['type'])
                ? $this->normalizeOptions($data['options'] ?? [])
                : null,
            'show_on_card' => $data['show_on_card'] ?? false,
            'sort_order' => ($board->customFields()->max('sort_order') ?? -1) + 1,
        ]);

        $this->broadcastFieldsChanged($board, 'custom_field.created', ['field_id' => $field->id]);

        return $field;
    }
}
