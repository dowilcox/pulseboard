<?php

namespace App\Actions\Tasks;

use App\Models\Attachment;
use App\Models\Task;
use App\Models\User;
use App\Services\ActivityLogger;
use Illuminate\Http\UploadedFile;
use Lorisleiva\Actions\Concerns\AsAction;

class UploadAttachment
{
    use AsAction;

    public function handle(Task $task, UploadedFile $file, User $user): Attachment
    {
        $path = $file->store("attachments/{$task->id}", 'local');

        $attachment = Attachment::create([
            'task_id' => $task->id,
            'user_id' => $user->id,
            'filename' => $file->getClientOriginalName(),
            'file_path' => $path,
            'file_size' => $file->getSize(),
            'mime_type' => $file->getMimeType(),
            'created_at' => now(),
        ]);

        ActivityLogger::log($task, 'attachment_added', [
            'filename' => $file->getClientOriginalName(),
        ], $user);

        return $attachment;
    }
}
