<?php

namespace App\Actions\Tasks;

use App\Services\ActivityLogger;
use Lorisleiva\Actions\Concerns\AsAction;
use Spatie\MediaLibrary\MediaCollections\Models\Media;

class DeleteAttachment
{
    use AsAction;

    public function handle(Media $media): void
    {
        $task = $media->model;

        $filename = $media->getCustomProperty('original_filename', $media->file_name);

        ActivityLogger::log($task, 'attachment_removed', [
            'filename' => $filename,
        ]);

        $media->delete();
    }
}
