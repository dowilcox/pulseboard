<?php

namespace App\Mcp\Support;

use App\Mcp\Exceptions\ToolException;
use App\Models\Board;
use App\Models\BoardCustomField;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;

/**
 * Translates board custom fields between the agent-friendly shape used by
 * the MCP tools (keyed by field name, select options by label) and the
 * stored shape (keyed by field id, options by id).
 *
 * Value validation stays in App\Support\CustomFieldValues, which the
 * CreateTask / UpdateTask actions run. This class only resolves names and
 * labels to ids and reports unknown or ambiguous ones.
 */
class CustomFields
{
    /**
     * Field definitions for get_board.
     *
     * @param  Collection<int, BoardCustomField>  $fields
     */
    public static function definitions(Collection $fields): array
    {
        return $fields->map(fn (BoardCustomField $field) => Presenter::compact([
            'id' => $field->id,
            'name' => $field->name,
            'type' => $field->type,
            'options' => $field->hasOptions()
                ? collect($field->options ?? [])->map(fn (array $o) => [
                    'id' => $o['id'] ?? null,
                    'label' => $o['label'] ?? null,
                ])->values()->all()
                : null,
            'show_on_card' => (bool) $field->show_on_card,
        ]))->values()->all();
    }

    /**
     * Stored values (keyed by field id) as `{field name: readable value}`,
     * in the board's field order, with option labels instead of ids. The
     * result can be passed back to create_task / update_task as-is.
     *
     * @param  Collection<int, BoardCustomField>  $fields
     */
    public static function present(Collection $fields, ?array $values): ?array
    {
        if (empty($values)) {
            return null;
        }

        $readable = [];

        foreach ($fields as $field) {
            if (! array_key_exists($field->id, $values)) {
                continue;
            }

            $value = $values[$field->id];

            $readable[$field->name] = match ($field->type) {
                BoardCustomField::TYPE_SELECT => self::optionLabel($field, $value),
                BoardCustomField::TYPE_MULTI_SELECT => array_map(
                    fn ($id) => self::optionLabel($field, $id),
                    is_array($value) ? $value : [$value],
                ),
                default => $value,
            };
        }

        return $readable === [] ? null : $readable;
    }

    /**
     * Activity change maps are keyed by field id; show field names and
     * option labels instead.
     *
     * @param  Collection<int, BoardCustomField>  $fields
     */
    public static function presentChange(Collection $fields, array $change): array
    {
        $byId = $fields->keyBy('id');

        foreach (['from', 'to'] as $side) {
            $named = [];

            foreach ((array) ($change[$side] ?? []) as $id => $value) {
                $field = $byId->get($id);
                $named[$field?->name ?? $id] = $field && $value !== null
                    ? (self::present(collect([$field]), [$id => $value])[$field->name] ?? $value)
                    : $value;
            }

            $change[$side] = $named;
        }

        return $change;
    }

    /**
     * Resolve `{field name|id: value}` input into `{field id: value}` for the
     * Actions. Select values may be option labels or ids (case-insensitive);
     * multi_select takes a list (a single string is accepted). Null clears.
     *
     * @throws ToolException
     */
    public static function resolveInput(Board $board, array $input): array
    {
        $fields = $board->customFields()->get();
        $resolved = [];

        foreach ($input as $key => $value) {
            $field = self::resolveField($board, $fields, (string) $key);

            if (isset($resolved[$field->id])) {
                throw new ToolException("Custom field \"{$field->name}\" was given more than once.");
            }

            $resolved[$field->id] = match (true) {
                $value === null => null,
                $field->type === BoardCustomField::TYPE_SELECT => is_string($value)
                    ? self::resolveOption($field, $value)
                    : $value,
                $field->type === BoardCustomField::TYPE_MULTI_SELECT => array_map(
                    fn ($v) => is_string($v) ? self::resolveOption($field, $v) : $v,
                    is_array($value) ? array_values($value) : [$value],
                ),
                default => $value,
            };
        }

        return $resolved;
    }

    /**
     * Apply list_tasks custom-field filters (all must match):
     *  - select / multi_select: an option label or id, or a list (matches any); null = empty
     *  - checkbox: true = checked, false/null = unchecked
     *  - text / number / date / url: true = has a value, false/null = empty,
     *    any other value = exact match
     *
     * @throws ToolException
     */
    public static function applyFilters(Builder $query, Board $board, array $filters): void
    {
        $fields = $board->customFields()->get();

        foreach ($filters as $key => $value) {
            $field = self::resolveField($board, $fields, (string) $key);
            $path = 'tasks.custom_fields->'.$field->id;

            if ($value === null || $value === false || $value === []) {
                $query->whereNull($path);

                continue;
            }

            if ($field->hasOptions()) {
                $optionIds = array_map(
                    fn ($v) => self::resolveOption($field, (string) $v),
                    is_array($value) ? array_values($value) : [$value],
                );

                $query->where(function (Builder $sub) use ($field, $path, $optionIds) {
                    foreach ($optionIds as $optionId) {
                        $field->type === BoardCustomField::TYPE_MULTI_SELECT
                            ? $sub->orWhereJsonContains($path, $optionId)
                            : $sub->orWhere($path, $optionId);
                    }
                });

                continue;
            }

            if ($value === true || $field->type === BoardCustomField::TYPE_CHECKBOX) {
                // Checkboxes are only stored when checked.
                $query->whereNotNull($path);

                continue;
            }

            if (! is_scalar($value)) {
                throw new ToolException("Filter value for custom field \"{$field->name}\" must be a single value, true (has a value) or null (empty).");
            }

            $query->where($path, $value);
        }
    }

    /**
     * @param  Collection<int, BoardCustomField>  $fields
     */
    private static function resolveField(Board $board, Collection $fields, string $key): BoardCustomField
    {
        $key = trim($key);

        $field = $fields->firstWhere('id', $key)
            ?? $fields->first(fn (BoardCustomField $f) => mb_strtolower($f->name) === mb_strtolower($key));

        if (! $field) {
            $available = $fields->pluck('name')->map(fn ($n) => "\"{$n}\"")->implode(', ') ?: 'none';

            throw new ToolException("Unknown custom field \"{$key}\" on board \"{$board->slug}\". Fields: {$available}. (Defining fields is not available over MCP.)");
        }

        return $field;
    }

    private static function resolveOption(BoardCustomField $field, string $value): string
    {
        $value = trim($value);
        $options = collect($field->options ?? []);

        $byId = $options->firstWhere('id', $value);
        $byLabel = $options->first(fn (array $o) => mb_strtolower((string) ($o['label'] ?? '')) === mb_strtolower($value));

        if ($byId && $byLabel && $byId['id'] !== $byLabel['id']) {
            throw new ToolException("\"{$value}\" is ambiguous for custom field \"{$field->name}\": it is one option's id and another option's label. Use the option id.");
        }

        $option = $byId ?? $byLabel;

        if (! $option) {
            $available = $options->pluck('label')->map(fn ($l) => "\"{$l}\"")->implode(', ') ?: 'none';

            throw new ToolException("\"{$value}\" is not an option of custom field \"{$field->name}\". Options: {$available}.");
        }

        return $option['id'];
    }

    private static function optionLabel(BoardCustomField $field, mixed $id): mixed
    {
        $option = collect($field->options ?? [])->firstWhere('id', $id);

        return $option['label'] ?? $id;
    }
}
