<?php

namespace App\Actions\Tasks;

use App\Models\Task;
use Illuminate\Http\UploadedFile;
use Lorisleiva\Actions\Concerns\AsAction;

class UploadTaskImage
{
    use AsAction;

    public function handle(Task $task, UploadedFile $file): string
    {
        $media = $task->addMedia($file)
            ->toMediaCollection('editor-images');

        return $media->getUrl();
    }
}
