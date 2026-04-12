<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TaskFigmaLink extends Model
{
    use HasFactory, HasUuids;

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

    public function resolveRouteBinding($value, $field = null): ?self
    {
        $query = $this->newQuery();

        $task = request()->route('task');
        if ($task instanceof Task) {
            $query->where('task_id', $task->id);
        }

        return $field
            ? $query->where($field, $value)->first()
            : $query->where('id', $value)->first();
    }
}
