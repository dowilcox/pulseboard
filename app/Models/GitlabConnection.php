<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class GitlabConnection extends Model
{
    use HasFactory, HasUuids;

    protected $keyType = 'string';

    public $incrementing = false;

    protected $guarded = [];

    protected $hidden = ['api_token', 'webhook_secret'];

    protected function casts(): array
    {
        return [
            'api_token' => 'encrypted',
            'webhook_secret' => 'encrypted',
            'is_active' => 'boolean',
        ];
    }

    public function team(): BelongsTo
    {
        return $this->belongsTo(Team::class);
    }

    public function projects(): HasMany
    {
        return $this->hasMany(GitlabProject::class);
    }

    public function resolveRouteBinding($value, $field = null): ?self
    {
        $query = $this->newQuery();

        $team = request()->route('team');
        if ($team instanceof Team) {
            $query->where('team_id', $team->id);
        }

        return $field
            ? $query->where($field, $value)->first()
            : $query->where('id', $value)->first();
    }
}
