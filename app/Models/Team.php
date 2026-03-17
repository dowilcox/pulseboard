<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;
use Spatie\MediaLibrary\HasMedia;
use Spatie\MediaLibrary\InteractsWithMedia;
use Spatie\MediaLibrary\MediaCollections\Models\Media;

class Team extends Model implements HasMedia
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
            ->acceptsMimeTypes(['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml']);
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

    public function members(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'team_members')
            ->using(TeamMember::class)
            ->withPivot('id', 'role')
            ->withTimestamps();
    }

    /**
     * The boards belonging to this team.
     */
    public function boards(): HasMany
    {
        return $this->hasMany(Board::class);
    }

    /**
     * The labels belonging to this team.
     */
    public function labels(): HasMany
    {
        return $this->hasMany(Label::class);
    }

    public function gitlabProjects(): HasMany
    {
        return $this->hasMany(GitlabProject::class);
    }

    public function gitlabConnections(): HasMany
    {
        return $this->hasMany(GitlabConnection::class);
    }

    public function figmaConnections(): HasMany
    {
        return $this->hasMany(FigmaConnection::class);
    }

    /**
     * Determine if the given user is a member of this team.
     */
    public function bots(): HasMany
    {
        return $this->hasMany(User::class, 'created_by_team_id')->where(
            'is_bot',
            true,
        );
    }

    public function hasUser(User $user): bool
    {
        return $this->members()->where('users.id', $user->id)->exists();
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

        // Try UUID first, then slug
        if (Str::isUuid($value)) {
            return $this->where('id', $value)->first();
        }

        return $this->where('slug', $value)->first();
    }
}
