<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    /** @use HasFactory<\Database\Factories\UserFactory> */
    use HasApiTokens, HasFactory, HasUuids, Notifiable;

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
     * The attributes that should be hidden for serialization.
     *
     * @var list<string>
     */
    protected $hidden = [
        'password',
        'remember_token',
    ];

    /**
     * The accessors to append to the model's array form.
     *
     * @var list<string>
     */
    protected $appends = [
        'avatar_url',
    ];

    /**
     * Get the user's avatar URL.
     *
     * Returns the DB value if explicitly set (e.g. SAML), otherwise our local
     * initials-SVG endpoint which generates a colored avatar deterministically.
     */
    protected function avatarUrl(): Attribute
    {
        return Attribute::make(
            get: function (?string $value) {
                if ($value) {
                    return $value;
                }

                return url("/avatars/{$this->id}");
            },
        );
    }

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'is_admin' => 'boolean',
            'is_bot' => 'boolean',
            'email_notification_prefs' => 'array',
            'ui_preferences' => 'array',
            'theme_preference' => 'string',
            'deactivated_at' => 'datetime',
        ];
    }

    /**
     * The teams this user belongs to.
     */
    public function teams(): BelongsToMany
    {
        return $this->belongsToMany(Team::class, 'team_members')
            ->using(TeamMember::class)
            ->withPivot('id', 'role')
            ->withTimestamps();
    }

    /**
     * The teams this user owns (role = owner).
     */
    public function ownedTeams(): BelongsToMany
    {
        return $this->belongsToMany(Team::class, 'team_members')
            ->withPivot('role')
            ->withTimestamps()
            ->wherePivot('role', 'owner');
    }

    /**
     * The team membership records for this user.
     */
    public function teamMemberships(): HasMany
    {
        return $this->hasMany(TeamMember::class);
    }

    /**
     * The tasks assigned to this user.
     */
    public function assignedTasks(): BelongsToMany
    {
        return $this->belongsToMany(Task::class, 'task_assignees')
            ->withPivot('assigned_at', 'assigned_by')
            ->using(TaskAssignee::class);
    }

    /**
     * Check if the user wants a specific notification type on a given channel.
     */
    public function wantsNotification(string $type, string $channel): bool
    {
        $prefs = $this->email_notification_prefs;

        if (empty($prefs) || ! isset($prefs[$type])) {
            return true; // Default: all notifications enabled
        }

        return (bool) ($prefs[$type][$channel] ?? true);
    }

    /**
     * Scope: only active (non-deactivated) users.
     */
    public function uiPreference(string $key, mixed $default = null): mixed
    {
        return data_get($this->ui_preferences, $key, $default);
    }

    public function scopeActive($query)
    {
        return $query->whereNull('deactivated_at');
    }
}
