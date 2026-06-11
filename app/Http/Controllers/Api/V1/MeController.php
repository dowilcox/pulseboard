<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Task;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MeController extends Controller
{
    public function show(Request $request): JsonResponse
    {
        return response()->json(['data' => $request->user()->only(['id', 'name', 'email', 'avatar_url', 'theme_preference', 'is_bot', 'created_at'])]);
    }

    public function tasks(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'per_page' => ['sometimes', 'integer', 'min:1', 'max:100'],
            'status' => ['sometimes', 'string', 'in:open,completed,all'],
        ]);

        $perPage = $validated['per_page'] ?? 50;
        $status = $validated['status'] ?? 'open';

        $query = Task::whereHas('assignees', function ($q) use ($request) {
            $q->where('users.id', $request->user()->id);
        })->with([
            'assignees',
            'labels',
            'column:id,name,board_id',
            // board.media is required for the image_url accessor, which
            // returns null unless the media relation is eager-loaded.
            'board:id,name,team_id',
            'board.media',
        ]);

        if ($status === 'open') {
            $query->whereNull('completed_at');
        } elseif ($status === 'completed') {
            $query->whereNotNull('completed_at');
        }

        $query->orderBy('due_date', 'asc')->orderBy('created_at', 'desc');

        return response()->json($query->paginate($perPage));
    }
}
