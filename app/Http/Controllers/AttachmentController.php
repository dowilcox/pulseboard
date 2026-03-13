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
            'file' => ['required', 'file', 'max:10240', 'mimes:jpg,jpeg,png,gif,webp,pdf,doc,docx,xls,xlsx,ppt,pptx,txt,csv,zip,mp4,webm,svg'],
        ], [
            'file.required' => 'Please select a file to upload.',
            'file.file' => 'The upload failed. The file may be too large (max 10MB) or the server rejected it.',
            'file.max' => 'The file is too large. Maximum size is 10MB.',
            'file.mimes' => 'This file type is not supported. Allowed types: images, PDF, Office documents, text, CSV, ZIP, and video files.',
        ]);

        UploadAttachment::run($task, $request->file('file'), $request->user());

        return Redirect::back();
    }

    public function download(Team $team, Board $board, Task $task, Attachment $attachment): StreamedResponse
    {
        $this->authorize('view', $task);

        abort_unless(Storage::disk('local')->exists($attachment->file_path), 404, 'File not found.');

        return Storage::disk('local')->download($attachment->file_path, $attachment->filename);
    }

    public function view(Team $team, Board $board, Task $task, Attachment $attachment): StreamedResponse
    {
        $this->authorize('view', $task);

        abort_unless(Storage::disk('local')->exists($attachment->file_path), 404, 'File not found.');

        return new StreamedResponse(function () use ($attachment) {
            $stream = Storage::disk('local')->readStream($attachment->file_path);
            fpassthru($stream);
            fclose($stream);
        }, 200, [
            'Content-Type' => $attachment->mime_type,
            'Content-Disposition' => 'inline; filename="'.addcslashes($attachment->filename, '"\\').'"',
            'Content-Length' => $attachment->file_size,
        ]);
    }

    public function destroy(Team $team, Board $board, Task $task, Attachment $attachment): RedirectResponse
    {
        $this->authorize('update', $task);

        DeleteAttachment::run($attachment);

        return Redirect::back();
    }
}
