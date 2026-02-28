<?php

namespace App\Actions\Tasks;

use App\Models\Task;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Lorisleiva\Actions\Concerns\AsAction;

class UploadTaskImage
{
    use AsAction;

    public function handle(Task $task, UploadedFile $file): string
    {
        $path = $file->store("task-images/{$task->id}", 'public');

        return Storage::disk('public')->url($path);
    }
}
