<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Column extends Model
{
    use HasFactory, HasUuids;

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
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'wip_limit' => 'integer',
            'sort_order' => 'integer',
            'is_done_column' => 'boolean',
        ];
    }

    /**
     * The board this column belongs to.
     */
    public function board(): BelongsTo
    {
        return $this->belongsTo(Board::class);
    }

    /**
     * The tasks in this column, ordered by sort_order.
     *
     * Note: Task model will be created in a later phase.
     */
    public function tasks(): HasMany
    {
        // This will reference a Task model created in a later phase.
        // For now, it's defined to document the intended relationship.
        return $this->hasMany('App\Models\Task')->orderBy('sort_order');
    }
}
