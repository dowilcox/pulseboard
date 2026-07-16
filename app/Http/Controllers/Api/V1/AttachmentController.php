<?php

namespace App\Http\Controllers\Api\V1;

use App\Actions\Tasks\DeleteAttachment;
use App\Actions\Tasks\UploadAttachment;
use App\Http\Controllers\Controller;
use App\Models\Board;
use App\Models\Task;
use App\Models\Team;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Validation\ValidationException;
use Spatie\MediaLibrary\MediaCollections\Exceptions\FileCannotBeAdded;
use Spatie\MediaLibrary\MediaCollections\Exceptions\FileIsTooBig;
use Spatie\MediaLibrary\MediaCollections\Exceptions\FileUnacceptableForCollection;
use Spatie\MediaLibrary\MediaCollections\Exceptions\MimeTypeNotAllowed;
use Spatie\MediaLibrary\MediaCollections\Models\Media;
use Symfony\Component\HttpFoundation\StreamedResponse;

class AttachmentController extends Controller
{
    public function index(Team $team, Board $board, Task $task): JsonResponse
    {
        $this->authorize('view', $task);

        $task->load('media');

        return response()->json(['data' => $task->attachments]);
    }

    public function store(Request $request, Team $team, Board $board, Task $task): JsonResponse
    {
        $this->authorize('update', $task);

        $maxSize = config('uploads.max_size.attachment');
        $attachmentTypes = config('uploads.attachment_types');
        $mimeMap = config('uploads.mime_types');
        $allowedTypes = implode(',', $attachmentTypes);
        $allowedMimeTypes = implode(',', array_values(array_unique(array_filter(array_map(
            fn (string $ext) => $mimeMap[$ext] ?? null,
            $attachmentTypes
        )))));

        $request->validate([
            'file' => [
                'required',
                'file',
                "max:{$maxSize}",
                "extensions:{$allowedTypes}",
                "mimetypes:{$allowedMimeTypes}",
            ],
        ], [
            'file.required' => 'Please select a file to upload.',
            'file.file' => 'The upload failed. The file may be too large or the server rejected it.',
            'file.max' => 'The file is too large. Maximum size is '.round($maxSize / 1024).'MB.',
            'file.extensions' => 'This file type is not supported. Allowed types: '.$allowedTypes,
            'file.mimetypes' => 'The file contents do not match its extension.',
        ]);

        try {
            $media = UploadAttachment::run($task, $request->file('file'), $request->user());
        } catch (FileIsTooBig) {
            throw ValidationException::withMessages(['file' => 'The file is too large. Maximum size is '.round($maxSize / 1024).'MB.']);
        } catch (MimeTypeNotAllowed|FileUnacceptableForCollection) {
            throw ValidationException::withMessages(['file' => 'This file type is not supported.']);
        } catch (FileCannotBeAdded $e) {
            throw ValidationException::withMessages(['file' => 'The file could not be uploaded: '.$e->getMessage()]);
        }

        $task->load('media');
        $attachment = collect($task->attachments)->firstWhere('id', $media->uuid);

        return response()->json(['data' => $attachment], 201);
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

    public function destroy(Team $team, Board $board, Task $task, string $media): Response
    {
        $this->authorize('update', $task);

        $mediaItem = Media::findByUuid($media);

        abort_unless($mediaItem && $mediaItem->model_id === $task->id, 404, 'File not found.');

        DeleteAttachment::run($mediaItem);

        return response()->noContent();
    }
}
