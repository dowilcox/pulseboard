<?php

namespace App\Actions\Media;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Lorisleiva\Actions\Concerns\AsAction;
use Spatie\MediaLibrary\HasMedia;
use Spatie\MediaLibrary\MediaCollections\Exceptions\FileCannotBeAdded;
use Spatie\MediaLibrary\MediaCollections\Exceptions\FileIsTooBig;

class UploadModelAvatar
{
    use AsAction;

    /**
     * Validate and store an avatar image on any HasMedia model.
     * Authorization is the caller's responsibility.
     */
    public function handle(Request $request, HasMedia $model): JsonResponse
    {
        $maxSize = (int) config('uploads.max_size.avatar');
        $allowedTypes = implode(',', config('uploads.image_types'));

        $request->validate([
            'image' => ['required', 'image', "max:{$maxSize}", "mimes:{$allowedTypes}"],
        ]);

        try {
            $model->addMedia($request->file('image'))
                ->toMediaCollection('avatar');
        } catch (FileIsTooBig) {
            $limit = self::maxSizeForHumans($maxSize);

            return response()->json(['message' => "The image is too large. Maximum size is {$limit}."], 422);
        } catch (FileCannotBeAdded $e) {
            return response()->json(['message' => 'The image could not be uploaded: '.$e->getMessage()], 422);
        }

        return response()->json([
            'image_url' => $model->getFirstMediaUrl('avatar', 'avatar'),
        ]);
    }

    /**
     * Format the configured avatar size limit (KB) for error messages.
     */
    public static function maxSizeForHumans(int $kilobytes): string
    {
        if ($kilobytes < 1024) {
            return "{$kilobytes}KB";
        }

        $megabytes = rtrim(rtrim(number_format($kilobytes / 1024, 1, '.', ''), '0'), '.');

        return "{$megabytes}MB";
    }
}
