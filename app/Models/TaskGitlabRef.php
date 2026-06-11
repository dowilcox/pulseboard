<?php

namespace App\Models;

use App\Models\Concerns\ScopesRouteBindingToParent;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TaskGitlabRef extends Model
{
    use HasFactory, HasUuids, ScopesRouteBindingToParent;

    protected $keyType = 'string';

    public $incrementing = false;

    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'gitlab_iid' => 'integer',
            'meta' => 'array',
            'last_synced_at' => 'datetime',
        ];
    }

    public function task(): BelongsTo
    {
        return $this->belongsTo(Task::class);
    }

    protected function parentRouteBinding(): array
    {
        return ['task', Task::class, 'task_id'];
    }
}
