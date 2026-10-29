<?php

namespace App\Actions\CustomFields;

use App\Actions\CustomFields\Concerns\ManagesCustomFieldDefinitions;
use App\Models\BoardCustomField;
use App\Support\CustomFieldValues;
use Lorisleiva\Actions\Concerns\AsAction;

class DeleteCustomField
{
    use AsAction;
    use ManagesCustomFieldDefinitions;

    /**
     * Delete a field and clear its value from every task on the board.
     *
     * The definition goes first: any value the cleanup misses is already
     * orphaned, and orphaned values are ignored and dropped on the task's
     * next save.
     */
    public function handle(BoardCustomField $field): void
    {
        $board = $field->board;
        $fieldId = $field->id;

        $field->delete();

        CustomFieldValues::purge($board, $fieldId);

        $this->broadcastFieldsChanged($board, 'custom_field.deleted', ['field_id' => $fieldId]);
    }
}
