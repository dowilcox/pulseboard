<?php

namespace App\Models\Concerns;

use Spatie\MediaLibrary\InteractsWithMedia;
use Spatie\MediaLibrary\MediaCollections\Models\Media;
use Symfony\Component\Mime\MimeTypes;

trait HasAvatarMedia
{
    use InteractsWithMedia;

    public function registerMediaCollections(): void
    {
        $this->addMediaCollection('avatar')
            ->singleFile()
            ->useDisk('public')
            ->acceptsMimeTypes(self::imageMimeTypes());
    }

    /**
     * Derive MIME types from the configured image extensions.
     */
    public static function imageMimeTypes(): array
    {
        $guesser = MimeTypes::getDefault();

        return array_unique(array_merge(...array_map(
            fn (string $ext) => $guesser->getMimeTypes($ext),
            config('uploads.image_types'),
        )));
    }

    public function registerMediaConversions(?Media $media = null): void
    {
        $this->addMediaConversion('avatar')
            ->width(128)
            ->height(128)
            ->sharpen(10)
            ->nonQueued()
            ->performOnCollections('avatar');

        $this->addMediaConversion('avatar-lg')
            ->width(256)
            ->height(256)
            ->sharpen(10)
            ->nonQueued()
            ->performOnCollections('avatar');
    }

    public function getImageUrlAttribute(): ?string
    {
        // Avoid N+1 media queries during serialization; eager-load `media` where needed
        if (! $this->relationLoaded('media')) {
            return null;
        }

        $media = $this->getFirstMedia('avatar');

        if (! $media) {
            return null;
        }

        return $media->getUrl('avatar');
    }
}
