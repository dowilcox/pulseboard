<?php

namespace App\Models;

use App\Models\Concerns\ScopesRouteBindingToParent;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A custom field defined on a board. Each task's value is stored in
 * `tasks.custom_fields[<field id>]`, so renaming a field keeps its values.
 *
 * `options` is only used by select / multi_select fields: a list of
 * `{id, label, color}` where `id` is stable across label edits.
 */
class BoardCustomField extends Model
{
    use HasFactory, HasUuids, ScopesRouteBindingToParent;

    public const TYPE_TEXT = 'text';

    public const TYPE_NUMBER = 'number';

    public const TYPE_DATE = 'date';

    public const TYPE_CHECKBOX = 'checkbox';

    public const TYPE_URL = 'url';

    public const TYPE_SELECT = 'select';

    public const TYPE_MULTI_SELECT = 'multi_select';

    public const TYPES = [
        self::TYPE_TEXT,
        self::TYPE_NUMBER,
        self::TYPE_DATE,
        self::TYPE_CHECKBOX,
        self::TYPE_URL,
        self::TYPE_SELECT,
        self::TYPE_MULTI_SELECT,
    ];

    /** Most fields a single board can define. */
    public const MAX_PER_BOARD = 50;

    /** Most options a select / multi_select field can define. */
    public const MAX_OPTIONS = 100;

    protected $keyType = 'string';

    public $incrementing = false;

    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'options' => 'array',
            'sort_order' => 'integer',
            'show_on_card' => 'boolean',
        ];
    }

    public function board(): BelongsTo
    {
        return $this->belongsTo(Board::class);
    }

    public static function typeHasOptions(string $type): bool
    {
        return in_array($type, [self::TYPE_SELECT, self::TYPE_MULTI_SELECT], true);
    }

    public function hasOptions(): bool
    {
        return self::typeHasOptions($this->type);
    }

    /**
     * Ids of this field's select options.
     *
     * @return array<int, string>
     */
    public function optionIds(): array
    {
        return array_values(array_filter(array_map(
            fn ($option) => is_array($option) ? ($option['id'] ?? null) : null,
            $this->options ?? [],
        )));
    }

    protected function parentRouteBinding(): array
    {
        return ['board', Board::class, 'board_id'];
    }
}
