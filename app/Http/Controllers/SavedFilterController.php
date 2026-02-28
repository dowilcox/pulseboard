<?php

namespace App\Http\Controllers;

use App\Models\Board;
use App\Models\SavedFilter;
use App\Models\Team;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SavedFilterController extends Controller
{
    public function index(Team $team, Board $board): JsonResponse
    {
        $filters = SavedFilter::where('board_id', $board->id)
            ->where('user_id', auth()->id())
            ->orderBy('name')
            ->get();

        return response()->json($filters);
    }

    public function store(Request $request, Team $team, Board $board): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'filter_config' => ['required', 'array'],
            'is_default' => ['boolean'],
        ]);

        // If setting as default, unset other defaults
        if ($validated['is_default'] ?? false) {
            SavedFilter::where('board_id', $board->id)
                ->where('user_id', auth()->id())
                ->update(['is_default' => false]);
        }

        $filter = SavedFilter::create([
            'board_id' => $board->id,
            'user_id' => auth()->id(),
            'name' => $validated['name'],
            'filter_config' => $validated['filter_config'],
            'is_default' => $validated['is_default'] ?? false,
        ]);

        return response()->json($filter, 201);
    }

    public function update(Request $request, Team $team, Board $board, SavedFilter $savedFilter): JsonResponse
    {
        abort_unless($savedFilter->user_id === auth()->id(), 403);

        $validated = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'filter_config' => ['sometimes', 'array'],
            'is_default' => ['sometimes', 'boolean'],
        ]);

        if ($validated['is_default'] ?? false) {
            SavedFilter::where('board_id', $board->id)
                ->where('user_id', auth()->id())
                ->where('id', '!=', $savedFilter->id)
                ->update(['is_default' => false]);
        }

        $savedFilter->update($validated);

        return response()->json($savedFilter);
    }

    public function destroy(Team $team, Board $board, SavedFilter $savedFilter): JsonResponse
    {
        abort_unless($savedFilter->user_id === auth()->id(), 403);

        $savedFilter->delete();

        return response()->json(['message' => 'Deleted']);
    }
}
