<?php

namespace App\Http\Controllers;

use App\Actions\Boards\CreateSavedFilter;
use App\Actions\Boards\UpdateSavedFilter;
use App\Models\Board;
use App\Models\SavedFilter;
use App\Models\Team;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SavedFilterController extends Controller
{
    public function index(Team $team, Board $board): JsonResponse
    {
        $this->authorize('view', $board);

        $filters = SavedFilter::where('board_id', $board->id)
            ->where('user_id', auth()->id())
            ->orderBy('name')
            ->get();

        return response()->json($filters);
    }

    public function store(Request $request, Team $team, Board $board): JsonResponse
    {
        $this->authorize('view', $board);

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'filter_config' => ['required', 'array'],
            'is_default' => ['boolean'],
        ]);

        $filter = CreateSavedFilter::run($board, $request->user(), $validated);

        return response()->json($filter, 201);
    }

    public function update(Request $request, Team $team, Board $board, SavedFilter $savedFilter): JsonResponse
    {
        abort_unless($savedFilter->board_id === $board->id, 404);
        abort_unless($savedFilter->user_id === auth()->id(), 403);
        $this->authorize('view', $board);

        $validated = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'filter_config' => ['sometimes', 'array'],
            'is_default' => ['sometimes', 'boolean'],
        ]);

        $filter = UpdateSavedFilter::run($savedFilter, $validated);

        return response()->json($filter);
    }

    public function destroy(Team $team, Board $board, SavedFilter $savedFilter): JsonResponse
    {
        abort_unless($savedFilter->board_id === $board->id, 404);
        abort_unless($savedFilter->user_id === auth()->id(), 403);
        $this->authorize('view', $board);

        $savedFilter->delete();

        return response()->json(['message' => 'Deleted']);
    }
}
