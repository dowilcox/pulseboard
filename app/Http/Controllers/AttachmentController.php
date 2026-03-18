<?php

namespace App\Http\Controllers;

use App\Actions\Tasks\DeleteAttachment;
use App\Actions\Tasks\UploadAttachment;
use App\Models\Board;
use App\Models\Task;
use App\Models\Team;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Redirect;
use Spatie\MediaLibrary\MediaCollections\Exceptions\FileCannotBeAdded;
use Spatie\MediaLibrary\MediaCollections\Exceptions\FileIsTooBig;
use Spatie\MediaLibrary\MediaCollections\Exceptions\FileUnacceptableForCollection;
use Spatie\MediaLibrary\MediaCollections\Exceptions\MimeTypeNotAllowed;
use Spatie\MediaLibrary\MediaCollections\Models\Media;
use Symfony\Component\HttpFoundation\StreamedResponse;

class AttachmentController extends Controller
{
    public function store(Request $request, Team $team, Board $board, Task $task): RedirectResponse
    {
        $this->authorize('update', $task);

        $maxSize = config('uploads.max_size.attachment');
        $allowedTypes = implode(',', config('uploads.attachment_types'));

        $request->validate([
            'file' => ['required', 'file', "max:{$maxSize}", "mimes:{$allowedTypes}"],
        ], [
            'file.required' => 'Please select a file to upload.',
            'file.file' => 'The upload failed. The file may be too large or the server rejected it.',
            'file.max' => 'The file is too large. Maximum size is '.round($maxSize / 1024).'MB.',
            'file.mimes' => 'This file type is not supported. Allowed types: '.$allowedTypes,
        ]);

        try {
            UploadAttachment::run($task, $request->file('file'), $request->user());
        } catch (FileIsTooBig) {
            return Redirect::back()->withErrors(['file' => 'The file is too large. Maximum size is 15MB.']);
        } catch (MimeTypeNotAllowed|FileUnacceptableForCollection) {
            return Redirect::back()->withErrors(['file' => 'This file type is not supported.']);
        } catch (FileCannotBeAdded $e) {
            return Redirect::back()->withErrors(['file' => 'The file could not be uploaded: '.$e->getMessage()]);
        }

        return Redirect::back();
    }

    public function download(Team $team, Board $board, Task $task, string $media): StreamedResponse
    {
        $this->authorize('view', $task);

        $mediaItem = Media::findByUuid($media);

        abort_unless($mediaItem && $mediaItem->model_id === $task->id, 404, 'File not found.');

        return response()->streamDownload(function () use ($mediaItem) {
            $stream = fopen($mediaItem->getPath(), 'r');
            fpassthru($stream);
            fclose($stream);
        }, $mediaItem->getCustomProperty('original_filename', $mediaItem->file_name), [
            'Content-Type' => $mediaItem->mime_type,
            'Content-Length' => $mediaItem->size,
        ]);
    }

    public function view(Team $team, Board $board, Task $task, string $media): StreamedResponse
    {
        $this->authorize('view', $task);

        $mediaItem = Media::findByUuid($media);

        abort_unless($mediaItem && $mediaItem->model_id === $task->id, 404, 'File not found.');

        $filename = $mediaItem->getCustomProperty('original_filename', $mediaItem->file_name);

        return new StreamedResponse(function () use ($mediaItem) {
            $stream = fopen($mediaItem->getPath(), 'r');
            fpassthru($stream);
            fclose($stream);
        }, 200, [
            'Content-Type' => $mediaItem->mime_type,
            'Content-Disposition' => 'inline; filename="'.addcslashes($filename, '"\\').'"',
            'Content-Length' => $mediaItem->size,
        ]);
    }

    public function destroy(Team $team, Board $board, Task $task, string $media): RedirectResponse
    {
        $this->authorize('update', $task);

        $mediaItem = Media::findByUuid($media);

        abort_unless($mediaItem && $mediaItem->model_id === $task->id, 404, 'File not found.');

        DeleteAttachment::run($mediaItem);

        return Redirect::back();
    }
}
