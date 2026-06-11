<?php

namespace App\Models;

use App\Models\Concerns\ScopesRouteBindingToParent;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class GitlabProject extends Model
{
    use HasFactory, HasUuids, ScopesRouteBindingToParent;

    protected $keyType = 'string';

    public $incrementing = false;

    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'gitlab_project_id' => 'integer',
            'webhook_id' => 'integer',
            'last_synced_at' => 'datetime',
        ];
    }

    public function connection(): BelongsTo
    {
        return $this->belongsTo(GitlabConnection::class, 'gitlab_connection_id');
    }

    public function team(): BelongsTo
    {
        return $this->belongsTo(Team::class);
    }

    protected function parentRouteBinding(): array
    {
        return ['team', Team::class, 'team_id'];
    }
}
