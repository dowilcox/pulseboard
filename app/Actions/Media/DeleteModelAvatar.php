<?php

namespace App\Actions\Media;

use Illuminate\Http\JsonResponse;
use Lorisleiva\Actions\Concerns\AsAction;
use Spatie\MediaLibrary\HasMedia;

class DeleteModelAvatar
{
    use AsAction;

    /**
     * Remove the avatar media from any HasMedia model.
     * Authorization is the caller's responsibility.
     */
    public function handle(HasMedia $model): JsonResponse
    {
        $model->clearMediaCollection('avatar');

        return response()->json(['message' => 'Image removed']);
    }
}
