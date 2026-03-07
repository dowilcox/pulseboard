<?php

namespace App\Http\Controllers\Api\V1;

use App\Actions\Tasks\CreateComment;
use App\Http\Controllers\Controller;
use App\Models\Board;
use App\Models\Task;
use App\Models\Team;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CommentController extends Controller
{
    public function index(Request $request, Team $team, Board $board, Task $task): JsonResponse
    {
        $this->authorize('view', $board);

        $validated = $request->validate([
            'per_page' => ['sometimes', 'integer', 'min:1', 'max:100'],
        ]);

        $comments = $task->comments()
            ->with('user')
            ->orderBy('created_at', 'desc')
            ->paginate($validated['per_page'] ?? 50);

        return response()->json($comments);
    }

    public function store(Request $request, Team $team, Board $board, Task $task): JsonResponse
    {
        $this->authorize('view', $board);

        $validated = $request->validate([
            'body' => ['required', 'string', 'max:10000'],
        ]);

        $comment = CreateComment::run($task, $validated['body'], $request->user());

        return response()->json(['data' => $comment], 201);
    }
}
