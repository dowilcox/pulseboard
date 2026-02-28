<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Team extends Model
{
    use HasFactory, HasUuids;

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

    public function members(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'team_members')
            ->withPivot('role')
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

    /**
     * Determine if the given user is a member of this team.
     */
    public function hasUser(User $user): bool
    {
        return $this->members()->where('users.id', $user->id)->exists();
    }
}
