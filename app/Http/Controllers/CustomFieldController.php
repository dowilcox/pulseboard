<?php

namespace App\Http\Controllers;

use App\Actions\CustomFields\CreateCustomField;
use App\Actions\CustomFields\DeleteCustomField;
use App\Actions\CustomFields\ReorderCustomFields;
use App\Actions\CustomFields\UpdateCustomField;
use App\Http\Requests\ReorderCustomFieldsRequest;
use App\Http\Requests\StoreCustomFieldRequest;
use App\Http\Requests\UpdateCustomFieldRequest;
use App\Models\Board;
use App\Models\BoardCustomField;
use App\Models\Team;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Redirect;

class CustomFieldController extends Controller
{
    /**
     * Add a custom field to the board.
     */
    public function store(StoreCustomFieldRequest $request, Team $team, Board $board): RedirectResponse
    {
        $this->authorize('manageCustomFields', $board);

        $field = CreateCustomField::run($board, $request->validated());

        return Redirect::back()->with('success', "Field “{$field->name}” added.");
    }

    /**
     * Update a custom field's name, options or card visibility.
     */
    public function update(UpdateCustomFieldRequest $request, Team $team, Board $board, BoardCustomField $customField): RedirectResponse
    {
        $this->authorize('manageCustomFields', $board);

        UpdateCustomField::run($customField, $request->validated());

        return Redirect::back()->with('success', 'Field saved.');
    }

    /**
     * Reorder the board's custom fields.
     */
    public function reorder(ReorderCustomFieldsRequest $request, Team $team, Board $board): RedirectResponse
    {
        $this->authorize('manageCustomFields', $board);

        ReorderCustomFields::run($board, $request->validated('field_ids'));

        return Redirect::back();
    }

    /**
     * Delete a custom field and clear its values from the board's tasks.
     */
    public function destroy(Team $team, Board $board, BoardCustomField $customField): RedirectResponse
    {
        $this->authorize('manageCustomFields', $board);

        $name = $customField->name;
        DeleteCustomField::run($customField);

        return Redirect::back()->with('success', "Field “{$name}” deleted.");
    }
}
