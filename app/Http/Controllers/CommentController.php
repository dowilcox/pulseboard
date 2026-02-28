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
use App\Models\TeamMember;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Redirect;

class CommentController extends Controller
{
    public function store(StoreCommentRequest $request, Team $team, Board $board, Task $task): RedirectResponse
    {
        $this->authorize('view', $task);

        CreateComment::run($task, $request->validated('body'), $request->user());

        return Redirect::back();
    }

    public function update(Request $request, Team $team, Board $board, Task $task, Comment $comment): RedirectResponse
    {
        if ($comment->user_id !== $request->user()->id) {
            abort(403, 'You can only edit your own comments.');
        }

        $validated = $request->validate([
            'body' => ['required', 'string'],
        ]);

        UpdateComment::run($comment, $validated['body']);

        return Redirect::back();
    }

    public function destroy(Request $request, Team $team, Board $board, Task $task, Comment $comment): RedirectResponse
    {
        $user = $request->user();

        // User can delete own comment, or admin/owner can delete any
        if ($comment->user_id !== $user->id) {
            $isAdminOrOwner = TeamMember::where('team_id', $team->id)
                ->where('user_id', $user->id)
                ->whereIn('role', ['owner', 'admin'])
                ->exists();

            if (! $isAdminOrOwner) {
                abort(403, 'You can only delete your own comments.');
            }
        }

        DeleteComment::run($comment);

        return Redirect::back();
    }
}
