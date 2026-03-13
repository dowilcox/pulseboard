<?php

namespace App\Http\Controllers\Api\V1;

use App\Actions\Tasks\CreateComment;
use App\Http\Controllers\Controller;
use App\Models\Board;
use App\Models\Comment;
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
            ->topLevel()
            ->with(['user', 'replies.user'])
            ->orderBy('created_at', 'desc')
            ->paginate($validated['per_page'] ?? 50);

        return response()->json($comments);
    }

    public function store(Request $request, Team $team, Board $board, Task $task): JsonResponse
    {
        $this->authorize('view', $board);

        $validated = $request->validate([
            'body' => ['required', 'string', 'max:10000'],
            'parent_id' => ['nullable', 'uuid', 'exists:comments,id'],
        ]);

        $parentId = $validated['parent_id'] ?? null;

        if ($parentId) {
            $parent = Comment::where('id', $parentId)->where('task_id', $task->id)->firstOrFail();
            $parentId = $parent->parent_id ?? $parent->id;
        }

        $comment = CreateComment::run($task, $validated['body'], $request->user(), $parentId);

        return response()->json(['data' => $comment], 201);
    }
}
