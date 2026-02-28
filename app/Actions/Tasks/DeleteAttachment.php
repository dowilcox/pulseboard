<?php

namespace App\Actions\Tasks;

use App\Models\Attachment;
use App\Services\ActivityLogger;
use Illuminate\Support\Facades\Storage;
use Lorisleiva\Actions\Concerns\AsAction;

class DeleteAttachment
{
    use AsAction;

    public function handle(Attachment $attachment): void
    {
        $task = $attachment->task;

        Storage::disk('local')->delete($attachment->file_path);

        ActivityLogger::log($task, 'attachment_removed', [
            'filename' => $attachment->filename,
        ]);

        $attachment->delete();
    }
}
