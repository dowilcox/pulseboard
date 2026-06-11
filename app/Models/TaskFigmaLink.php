<?php

namespace App\Models;

use App\Models\Concerns\ScopesRouteBindingToParent;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TaskFigmaLink extends Model
{
    use HasFactory, HasUuids, ScopesRouteBindingToParent;

    protected $keyType = 'string';

    public $incrementing = false;

    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'meta' => 'array',
            'last_synced_at' => 'datetime',
            'last_modified_at' => 'datetime',
        ];
    }

    public function task(): BelongsTo
    {
        return $this->belongsTo(Task::class);
    }

    public function figmaConnection(): BelongsTo
    {
        return $this->belongsTo(FigmaConnection::class);
    }

    protected function parentRouteBinding(): array
    {
        return ['task', Task::class, 'task_id'];
    }
}
