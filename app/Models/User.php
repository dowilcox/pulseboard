<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\MorphMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\DatabaseNotification;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasApiTokens, HasFactory, HasUuids, Notifiable;

    /**
     * Notification types users can switch on or off per channel.
     */
    public const NOTIFICATION_TYPES = [
        'task_assigned',
        'task_commented',
        'task_comment_replied',
        'task_mentioned',
        'task_completed',
        'task_attachment_added',
        'task_due_soon',
        'task_overdue',
    ];

    public const NOTIFICATION_CHANNELS = ['in_app', 'email'];

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

    protected static function booted(): void
    {
        // activities.user_id is nulled by the foreign key when the user row
        // goes; flag the rows first so the feed can say "Deleted user"
        // rather than mistaking them for system activity.
        static::deleting(function (User $user): void {
            Activity::where('user_id', $user->id)->update(['actor_deleted' => true]);
        });
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
    public function createdByTeam(): BelongsTo
    {
        return $this->belongsTo(Team::class, 'created_by_team_id');
    }

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
     * The tasks this user is watching.
     */
    public function watchedTasks(): BelongsToMany
    {
        return $this->belongsToMany(Task::class, 'task_watchers')
            ->withPivot('created_at');
    }

    /**
     * The user's in-app inbox: the bell, the notifications list, the unread
     * count and the API. Email-only records (in_app = false) are stored so
     * notifications:send-emails can batch them, but are never shown here.
     */
    public function notifications(): MorphMany
    {
        return $this->morphMany(DatabaseNotification::class, 'notifiable')
            ->where('in_app', true)
            ->latest();
    }

    /**
     * What applies when a user hasn't saved a type or channel: everything on.
     *
     * @return array<string, array{in_app: bool, email: bool}>
     */
    public static function defaultNotificationPreferences(): array
    {
        return array_fill_keys(
            self::NOTIFICATION_TYPES,
            array_fill_keys(self::NOTIFICATION_CHANNELS, true),
        );
    }

    /**
     * Saved preferences merged over the defaults, one entry per type and
     * channel. This is exactly what wantsNotification() decides from.
     *
     * @return array<string, array{in_app: bool, email: bool}>
     */
    public function notificationPreferences(): array
    {
        $saved = $this->email_notification_prefs ?? [];
        $resolved = self::defaultNotificationPreferences();

        foreach ($resolved as $type => $channels) {
            foreach ($channels as $channel => $default) {
                $resolved[$type][$channel] = (bool) ($saved[$type][$channel] ?? $default);
            }
        }

        return $resolved;
    }

    /**
     * Check if the user wants a specific notification type on a given channel.
     * Types without a preference (e.g. automation) are always on.
     */
    public function wantsNotification(string $type, string $channel): bool
    {
        return $this->notificationPreferences()[$type][$channel] ?? true;
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
