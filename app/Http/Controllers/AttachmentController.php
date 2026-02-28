<?php

namespace App\Http\Controllers;

use App\Actions\Tasks\DeleteAttachment;
use App\Actions\Tasks\UploadAttachment;
use App\Models\Attachment;
use App\Models\Board;
use App\Models\Task;
use App\Models\Team;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Redirect;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

class AttachmentController extends Controller
{
    public function store(Request $request, Team $team, Board $board, Task $task): RedirectResponse
    {
        $this->authorize('update', $task);

        $request->validate([
            'file' => ['required', 'file', 'max:10240'], // 10MB max
        ]);

        UploadAttachment::run($task, $request->file('file'), $request->user());

        return Redirect::back();
    }

    public function download(Team $team, Board $board, Task $task, Attachment $attachment): StreamedResponse
    {
        $this->authorize('view', $task);

        return Storage::disk('local')->download($attachment->file_path, $attachment->filename);
    }

    public function destroy(Team $team, Board $board, Task $task, Attachment $attachment): RedirectResponse
    {
        $this->authorize('update', $task);

        DeleteAttachment::run($attachment);

        return Redirect::back();
    }
}
