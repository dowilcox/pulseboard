<?php

namespace App\Http\Controllers\Api\V1;

use App\Actions\CustomFields\CreateCustomField;
use App\Actions\CustomFields\DeleteCustomField;
use App\Actions\CustomFields\ReorderCustomFields;
use App\Actions\CustomFields\UpdateCustomField;
use App\Http\Controllers\Controller;
use App\Http\Requests\ReorderCustomFieldsRequest;
use App\Http\Requests\StoreCustomFieldRequest;
use App\Http\Requests\UpdateCustomFieldRequest;
use App\Models\Board;
use App\Models\BoardCustomField;
use App\Models\Team;
use Illuminate\Http\JsonResponse;

class CustomFieldController extends Controller
{
    public function index(Team $team, Board $board): JsonResponse
    {
        $this->authorize('view', $board);

        return response()->json(['data' => $board->customFields()->get()]);
    }

    public function store(StoreCustomFieldRequest $request, Team $team, Board $board): JsonResponse
    {
        $this->authorize('manageCustomFields', $board);

        $field = CreateCustomField::run($board, $request->validated());

        return response()->json(['data' => $field], 201);
    }

    public function update(UpdateCustomFieldRequest $request, Team $team, Board $board, BoardCustomField $customField): JsonResponse
    {
        $this->authorize('manageCustomFields', $board);
        abort_unless($customField->board_id === $board->id, 404);

        $field = UpdateCustomField::run($customField, $request->validated());

        return response()->json(['data' => $field]);
    }

    public function reorder(ReorderCustomFieldsRequest $request, Team $team, Board $board): JsonResponse
    {
        $this->authorize('manageCustomFields', $board);

        $fields = ReorderCustomFields::run($board, $request->validated('field_ids'));

        return response()->json(['data' => $fields]);
    }

    public function destroy(Team $team, Board $board, BoardCustomField $customField): JsonResponse
    {
        $this->authorize('manageCustomFields', $board);
        abort_unless($customField->board_id === $board->id, 404);

        DeleteCustomField::run($customField);

        return response()->json(null, 204);
    }
}
