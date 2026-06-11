<?php

namespace App\Models;

use App\Models\Concerns\ScopesRouteBindingToParent;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class FigmaConnection extends Model
{
    use HasFactory, HasUuids, ScopesRouteBindingToParent;

    protected $keyType = 'string';

    public $incrementing = false;

    protected $guarded = [];

    protected $hidden = ['api_token'];

    protected function casts(): array
    {
        return [
            'api_token' => 'encrypted',
            'is_active' => 'boolean',
        ];
    }

    public function team(): BelongsTo
    {
        return $this->belongsTo(Team::class);
    }

    public function taskLinks(): HasMany
    {
        return $this->hasMany(TaskFigmaLink::class);
    }

    protected function parentRouteBinding(): array
    {
        return ['team', Team::class, 'team_id'];
    }
}
