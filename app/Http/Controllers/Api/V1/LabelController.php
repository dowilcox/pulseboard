<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreLabelRequest;
use App\Models\Label;
use App\Models\Team;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class LabelController extends Controller
{
    public function index(Team $team): JsonResponse
    {
        $this->authorize('view', $team);

        return response()->json(['data' => $team->labels()->orderBy('name')->get()]);
    }

    public function store(StoreLabelRequest $request, Team $team): JsonResponse
    {
        $this->authorize('update', $team);

        $label = $team->labels()->create($request->validated());

        return response()->json(['data' => $label], 201);
    }

    public function update(Request $request, Team $team, Label $label): JsonResponse
    {
        $this->authorize('update', $team);
        abort_unless($label->team_id === $team->id, 404);

        $validated = $request->validate([
            'name' => ['sometimes', 'string', 'max:50'],
            'color' => ['sometimes', 'string', 'regex:/^#[0-9a-fA-F]{6}$/'],
        ]);

        $label->update($validated);

        return response()->json(['data' => $label->refresh()]);
    }

    public function destroy(Team $team, Label $label): JsonResponse
    {
        $this->authorize('update', $team);
        abort_unless($label->team_id === $team->id, 404);

        $label->delete();

        return response()->json(null, 204);
    }
}
