<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;
use Spatie\MediaLibrary\HasMedia;
use Spatie\MediaLibrary\InteractsWithMedia;
use Spatie\MediaLibrary\MediaCollections\Models\Media;

class Task extends Model implements HasMedia
{
    use HasFactory, HasUuids, InteractsWithMedia;

    protected $keyType = 'string';

    public $incrementing = false;

    protected $guarded = [];

    protected $appends = ['is_completed', 'checklist_progress', 'slug'];

    protected $hidden = ['media'];

    protected function casts(): array
    {
        return [
            'sort_order' => 'float',
            'priority' => 'string',
            'due_date' => 'date:Y-m-d',
            'custom_fields' => 'array',
            'completed_at' => 'datetime',
            'checklists' => 'array',
            'links' => 'array',
            'recurrence_config' => 'array',
            'recurrence_next_at' => 'datetime',
        ];
    }

    public function registerMediaCollections(): void
    {
        $this->addMediaCollection('attachments')
            ->useDisk('local');

        $this->addMediaCollection('editor-images')
            ->useDisk('public');
    }

    public function registerMediaConversions(?Media $media = null): void
    {
        $this->addMediaConversion('thumb')
            ->width(200)
            ->height(200)
            ->nonQueued()
            ->performOnCollections('attachments');
    }

    public function board(): BelongsTo
    {
        return $this->belongsTo(Board::class);
    }

    public function column(): BelongsTo
    {
        return $this->belongsTo(Column::class);
    }

    public function parentTask(): BelongsTo
    {
        return $this->belongsTo(Task::class, 'parent_task_id');
    }

    public function subtasks(): HasMany
    {
        return $this->hasMany(Task::class, 'parent_task_id');
    }

    public function assignees(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'task_assignees')
            ->withPivot('assigned_at', 'assigned_by')
            ->using(TaskAssignee::class);
    }

    public function watchers(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'task_watchers')
            ->withPivot('created_at');
    }

    public function labels(): BelongsToMany
    {
        return $this->belongsToMany(Label::class, 'task_labels');
    }

    public function comments(): HasMany
    {
        return $this->hasMany(Comment::class);
    }

    public function activities(): HasMany
    {
        return $this->hasMany(Activity::class);
    }

    public function getAttachmentsAttribute(): array
    {
        if (! $this->relationLoaded('media')) {
            return [];
        }

        $media = $this->getMedia('attachments');

        if ($media->isEmpty()) {
            return [];
        }

        $userIds = $media->map(fn ($m) => $m->getCustomProperty('uploaded_by'))->filter()->unique();
        $users = $userIds->isNotEmpty()
            ? User::whereIn('id', $userIds)->get()->keyBy('id')
            : collect();

        return $media->map(function ($item) use ($users) {
            $userId = $item->getCustomProperty('uploaded_by');
            $user = $userId ? $users->get($userId) : null;

            return [
                'id' => $item->uuid,
                'task_id' => $item->model_id,
                'user_id' => $userId,
                'filename' => $item->getCustomProperty('original_filename', $item->file_name),
                'file_size' => $item->size,
                'mime_type' => $item->mime_type,
                'thumbnail_url' => $item->hasGeneratedConversion('thumb')
                    ? $item->getUrl('thumb')
                    : null,
                'created_at' => $item->created_at?->toISOString(),
                'user' => $user ? [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                    'avatar_url' => $user->avatar_url ?? null,
                ] : null,
            ];
        })->values()->all();
    }

    public function gitlabProject(): BelongsTo
    {
        return $this->belongsTo(GitlabProject::class);
    }

    public function gitlabRefs(): HasMany
    {
        return $this->hasMany(TaskGitlabRef::class);
    }

    public function figmaLinks(): HasMany
    {
        return $this->hasMany(TaskFigmaLink::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function scopeInColumn(Builder $query, string $columnId): Builder
    {
        return $query->where('column_id', $columnId);
    }

    public function scopeWithPriority(Builder $query, string $priority): Builder
    {
        return $query->where('priority', $priority);
    }

    /**
     * Tasks that this task depends on (i.e. tasks blocking this one).
     */
    public function blockedBy(): BelongsToMany
    {
        return $this->belongsToMany(
            Task::class,
            'task_dependencies',
            'task_id',
            'depends_on_task_id',
        )->withPivot('created_by', 'created_at');
    }

    /**
     * Tasks that depend on this task (i.e. tasks this one is blocking).
     */
    public function dependencies(): BelongsToMany
    {
        return $this->belongsToMany(
            Task::class,
            'task_dependencies',
            'depends_on_task_id',
            'task_id',
        )->withPivot('created_by', 'created_at');
    }

    public function getIsCompletedAttribute(): bool
    {
        return $this->completed_at !== null;
    }

    public function getChecklistProgressAttribute(): ?array
    {
        if (! $this->checklists) {
            return null;
        }

        $total = 0;
        $completed = 0;

        foreach ($this->checklists as $checklist) {
            foreach ($checklist['items'] ?? [] as $item) {
                $total++;
                if ($item['completed'] ?? false) {
                    $completed++;
                }
            }
        }

        return $total > 0
            ? ['completed' => $completed, 'total' => $total]
            : null;
    }

    public function getSlugAttribute(): ?string
    {
        if (! $this->task_number) {
            return null;
        }

        return $this->task_number.'-'.Str::slug($this->title);
    }

    public function getRouteKey(): string
    {
        return $this->slug ?? $this->id;
    }

    public function resolveRouteBinding($value, $field = null): ?self
    {
        if ($field) {
            return $this->where($field, $value)->first();
        }

        $query = $this->newQuery();

        // Scope to the parent board if resolved in the route
        $board = request()->route('board');
        if ($board instanceof Board) {
            $query->where('board_id', $board->id);
        }

        // Try UUID first
        if (Str::isUuid($value)) {
            return $query->where('id', $value)->first();
        }

        // Parse {number}-{slug} format — only the number matters
        $taskNumber = (int) $value;
        if ($taskNumber > 0) {
            return $query->where('task_number', $taskNumber)->first();
        }

        return null;
    }
}
