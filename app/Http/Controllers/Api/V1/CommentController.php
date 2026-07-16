<?php

namespace App\Http\Controllers\Api\V1;

use App\Actions\Tasks\CreateComment;
use App\Actions\Tasks\DeleteComment;
use App\Actions\Tasks\UpdateComment;
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
            'body' => ['required', 'string', 'max:65535'],
            'parent_id' => ['nullable', 'uuid', 'exists:comments,id'],
        ]);

        // Parent resolution (including reply flattening) happens in CreateComment
        // so web and API comment creation behave identically.
        $comment = CreateComment::run(
            $task,
            $validated['body'],
            $request->user(),
            $validated['parent_id'] ?? null,
        );

        return response()->json(['data' => $comment], 201);
    }

    public function update(Request $request, Team $team, Board $board, Task $task, Comment $comment): JsonResponse
    {
        $this->authorize('update', $comment);

        $validated = $request->validate([
            'body' => ['required', 'string', 'max:65535'],
        ]);

        $comment = UpdateComment::run($comment, $validated['body']);

        return response()->json(['data' => $comment]);
    }

    public function destroy(Team $team, Board $board, Task $task, Comment $comment): JsonResponse
    {
        $this->authorize('delete', $comment);

        DeleteComment::run($comment);

        return response()->json(null, 204);
    }
}
