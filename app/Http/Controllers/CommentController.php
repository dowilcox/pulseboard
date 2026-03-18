<?php

namespace App\Http\Controllers;

use App\Actions\Tasks\CreateComment;
use App\Actions\Tasks\DeleteComment;
use App\Actions\Tasks\UpdateComment;
use App\Http\Requests\StoreCommentRequest;
use App\Models\Board;
use App\Models\Comment;
use App\Models\Task;
use App\Models\Team;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Redirect;

class CommentController extends Controller
{
    public function store(StoreCommentRequest $request, Team $team, Board $board, Task $task): RedirectResponse
    {
        $this->authorize('view', $task);

        $parentId = $request->validated('parent_id');

        if ($parentId) {
            $parent = Comment::where('id', $parentId)->where('task_id', $task->id)->firstOrFail();
            // Flatten to one level: if replying to a reply, attach to the root parent
            $parentId = $parent->parent_id ?? $parent->id;
        }

        CreateComment::run($task, $request->validated('body'), $request->user(), $parentId);

        return Redirect::back();
    }

    public function update(Request $request, Team $team, Board $board, Task $task, Comment $comment): RedirectResponse
    {
        $this->authorize('update', $comment);

        $validated = $request->validate([
            'body' => ['required', 'string', 'max:65535'],
        ]);

        UpdateComment::run($comment, $validated['body']);

        return Redirect::back();
    }

    public function destroy(Request $request, Team $team, Board $board, Task $task, Comment $comment): RedirectResponse
    {
        $this->authorize('delete', $comment);

        DeleteComment::run($comment);

        return Redirect::back();
    }
}
