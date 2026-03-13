<?php

namespace App\Actions\Tasks;

use App\Models\Task;
use App\Models\User;
use App\Services\ActivityLogger;
use Illuminate\Http\UploadedFile;
use Lorisleiva\Actions\Concerns\AsAction;
use Spatie\MediaLibrary\MediaCollections\Exceptions\FileIsTooBig;
use Spatie\MediaLibrary\MediaCollections\Models\Media;

class UploadAttachment
{
    use AsAction;

    /**
     * @throws FileIsTooBig
     */
    public function handle(Task $task, UploadedFile $file, User $user): Media
    {
        $media = $task->addMedia($file)
            ->withCustomProperties([
                'original_filename' => $file->getClientOriginalName(),
                'uploaded_by' => $user->id,
            ])
            ->toMediaCollection('attachments');

        ActivityLogger::log($task, 'attachment_added', [
            'filename' => $file->getClientOriginalName(),
        ], $user);

        return $media;
    }
}
