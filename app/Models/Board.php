<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;
use Spatie\MediaLibrary\HasMedia;
use Spatie\MediaLibrary\InteractsWithMedia;
use Spatie\MediaLibrary\MediaCollections\Models\Media;

class Board extends Model implements HasMedia
{
    use HasFactory, HasUuids, InteractsWithMedia;

    /**
     * The primary key type.
     */
    protected $keyType = 'string';

    /**
     * Indicates if the IDs are auto-incrementing.
     */
    public $incrementing = false;

    /**
     * The attributes that aren't guarded.
     *
     * @var array<int, string>
     */
    protected $guarded = [];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'is_archived' => 'boolean',
            'sort_order' => 'integer',
            'settings' => 'array',
        ];
    }

    protected $appends = ['image_url'];

    protected $hidden = ['media'];

    public function registerMediaCollections(): void
    {
        $this->addMediaCollection('avatar')
            ->singleFile()
            ->useDisk('public')
            ->acceptsMimeTypes(config('uploads.image_mime_types'));
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
        $media = $this->getFirstMedia('avatar');

        if (! $media) {
            return null;
        }

        return $media->getUrl('avatar');
    }

    /**
     * The team this board belongs to.
     */
    public function team(): BelongsTo
    {
        return $this->belongsTo(Team::class);
    }

    /**
     * The columns on this board, ordered by sort_order.
     */
    public function columns(): HasMany
    {
        return $this->hasMany(Column::class)->orderBy('sort_order');
    }

    public function tasks(): HasMany
    {
        return $this->hasMany(Task::class);
    }

    public function automationRules(): HasMany
    {
        return $this->hasMany(AutomationRule::class);
    }

    public function defaultTaskTemplate(): BelongsTo
    {
        return $this->belongsTo(TaskTemplate::class, 'default_task_template_id');
    }

    /**
     * Scope to only active (non-archived) boards.
     */
    public function setting(string $key, mixed $default = null): mixed
    {
        return data_get($this->settings, $key, $default);
    }

    public function scopeActive(Builder $query): Builder
    {
        return $query->where('is_archived', false);
    }

    public function getRouteKey(): string
    {
        return $this->slug;
    }

    public function resolveRouteBinding($value, $field = null): ?self
    {
        if ($field) {
            return $this->where($field, $value)->first();
        }

        $query = $this->newQuery();

        // Scope to the parent team if resolved in the route
        $team = request()->route('team');
        if ($team instanceof Team) {
            $query->where('team_id', $team->id);
        }

        if (Str::isUuid($value)) {
            return $query->where('id', $value)->first();
        }

        return $query->where('slug', $value)->first();
    }
}
