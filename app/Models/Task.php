<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Task extends Model
{
    use HasFactory, HasUuids;

    protected $keyType = 'string';

    public $incrementing = false;

    protected $guarded = [];

    protected $appends = ['is_completed', 'checklist_progress'];

    protected function casts(): array
    {
        return [
            'sort_order' => 'float',
            'priority' => 'string',
            'due_date' => 'date',
            'custom_fields' => 'array',
            'completed_at' => 'datetime',
            'checklists' => 'array',
            'recurrence_config' => 'array',
            'recurrence_next_at' => 'datetime',
        ];
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

    public function attachments(): HasMany
    {
        return $this->hasMany(Attachment::class);
    }

    public function gitlabLinks(): HasMany
    {
        return $this->hasMany(TaskGitlabLink::class);
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

    public function dependencies(): BelongsToMany
    {
        return $this->belongsToMany(Task::class, 'task_dependencies', 'task_id', 'depends_on_task_id')
            ->withPivot('created_by', 'created_at');
    }

    public function blockedBy(): BelongsToMany
    {
        return $this->belongsToMany(Task::class, 'task_dependencies', 'depends_on_task_id', 'task_id')
            ->withPivot('created_by', 'created_at');
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

        return $total > 0 ? ['completed' => $completed, 'total' => $total] : null;
    }
}
