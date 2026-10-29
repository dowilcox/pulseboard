<?php

namespace App\Support;

use App\Models\Board;
use App\Models\BoardCustomField;
use App\Models\Task;
use Illuminate\Support\Collection;
use Illuminate\Validation\ValidationException;

/**
 * Validates and stores task values for a board's custom fields.
 *
 * Values live in `tasks.custom_fields` keyed by field definition id:
 *
 *   text          string (trimmed, max 1000 chars)
 *   number        int|float
 *   date          "Y-m-d"
 *   checkbox      true (unchecked is stored as no value)
 *   url           absolute http(s) URL (max 2048 chars)
 *   select        option id
 *   multi_select  list of option ids
 *
 * Updates are partial: keys present in the input replace that field's value,
 * `null` (or an empty value) clears it, and fields not mentioned keep their
 * stored value. Keys that aren't fields on the board are dropped, so a stale
 * client that still knows a deleted field can't block the rest of a save.
 */
class CustomFieldValues
{
    public const TEXT_MAX_LENGTH = 1000;

    public const URL_MAX_LENGTH = 2048;

    /** Absolute bound on number values (keeps them exact as JSON numbers). */
    public const NUMBER_MAX = 1e15;

    /**
     * Merge `$input` into `$existing`, validating each value against its
     * field definition. Returns null when the task ends up with no values.
     *
     * @param  array<string, mixed>|null  $input  Null clears every value.
     * @param  array<string, mixed>|null  $existing
     * @return array<string, mixed>|null
     *
     * @throws ValidationException
     */
    public static function merge(Board $board, ?array $input, ?array $existing = null): ?array
    {
        if ($input === null) {
            return null;
        }

        $fields = $board->customFields()->get()->keyBy('id');

        // Drop stored values for fields that no longer exist.
        $values = array_intersect_key($existing ?? [], $fields->all());
        $errors = [];

        foreach ($input as $fieldId => $raw) {
            $field = $fields->get((string) $fieldId);

            if (! $field) {
                continue;
            }

            [$value, $error] = self::normalize($field, $raw);

            if ($error !== null) {
                $errors["custom_fields.{$fieldId}"] = [$error];

                continue;
            }

            if ($value === null) {
                unset($values[$field->id]);
            } else {
                $values[$field->id] = $value;
            }
        }

        if ($errors !== []) {
            throw ValidationException::withMessages($errors);
        }

        return $values === [] ? null : self::ordered($values, $fields);
    }

    /**
     * Normalize one raw value for a field.
     *
     * @return array{0: mixed, 1: string|null} [normalized value or null to clear, error message]
     */
    public static function normalize(BoardCustomField $field, mixed $raw): array
    {
        if ($raw === null || $raw === '' || $raw === []) {
            return [null, null];
        }

        $name = $field->name;

        switch ($field->type) {
            case BoardCustomField::TYPE_TEXT:
                if (! is_string($raw) && ! is_int($raw) && ! is_float($raw)) {
                    return [null, "{$name} must be text."];
                }
                $text = trim((string) $raw);
                if (mb_strlen($text) > self::TEXT_MAX_LENGTH) {
                    return [null, "{$name} may not be longer than ".self::TEXT_MAX_LENGTH.' characters.'];
                }

                return [$text === '' ? null : $text, null];

            case BoardCustomField::TYPE_NUMBER:
                if (is_bool($raw) || ! is_numeric($raw)) {
                    return [null, "{$name} must be a number."];
                }
                $number = $raw + 0;
                if (! is_finite((float) $number) || abs((float) $number) > self::NUMBER_MAX) {
                    return [null, "{$name} is out of range."];
                }
                if (is_float($number) && floor($number) === $number && abs($number) <= PHP_INT_MAX) {
                    $number = (int) $number;
                }

                return [$number, null];

            case BoardCustomField::TYPE_DATE:
                if (! is_string($raw) || ! preg_match('/^(\d{4})-(\d{2})-(\d{2})$/', $raw, $m)
                    || ! checkdate((int) $m[2], (int) $m[3], (int) $m[1])) {
                    return [null, "{$name} must be a date in YYYY-MM-DD format."];
                }

                return [$raw, null];

            case BoardCustomField::TYPE_CHECKBOX:
                $bool = is_bool($raw) ? $raw : filter_var($raw, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
                if ($bool === null) {
                    return [null, "{$name} must be true or false."];
                }

                return [$bool ? true : null, null];

            case BoardCustomField::TYPE_URL:
                if (! is_string($raw)) {
                    return [null, "{$name} must be a valid URL."];
                }
                $url = trim($raw);
                if ($url === '') {
                    return [null, null];
                }
                $scheme = strtolower((string) parse_url($url, PHP_URL_SCHEME));
                if (mb_strlen($url) > self::URL_MAX_LENGTH
                    || filter_var($url, FILTER_VALIDATE_URL) === false
                    || ! in_array($scheme, ['http', 'https'], true)) {
                    return [null, "{$name} must be a valid http(s) URL."];
                }

                return [$url, null];

            case BoardCustomField::TYPE_SELECT:
                if (! is_string($raw) || ! in_array($raw, $field->optionIds(), true)) {
                    return [null, "{$name} must be one of the field's options."];
                }

                return [$raw, null];

            case BoardCustomField::TYPE_MULTI_SELECT:
                if (! is_array($raw) || ! array_is_list($raw)) {
                    return [null, "{$name} must be a list of the field's options."];
                }
                $allowed = $field->optionIds();
                foreach ($raw as $optionId) {
                    if (! is_string($optionId) || ! in_array($optionId, $allowed, true)) {
                        return [null, "{$name} must only contain the field's options."];
                    }
                }
                // Keep the definition's option order so values compare equal.
                $selected = array_values(array_intersect($allowed, $raw));

                return [$selected === [] ? null : $selected, null];
        }

        return [null, "{$name} has an unsupported type."];
    }

    /**
     * Remove a field's values (or only some of its select options) from
     * every task on the board, in chunks.
     *
     * @param  array<int, string>|null  $optionIds  Only clear these options; null clears the field.
     */
    public static function purge(Board $board, string $fieldId, ?array $optionIds = null): void
    {
        if ($optionIds !== null && $optionIds === []) {
            return;
        }

        Task::query()
            ->where('board_id', $board->id)
            ->whereNotNull('custom_fields')
            // JSON is stored as text on both MySQL and SQLite; this cheaply
            // narrows to tasks that mention the field at all.
            ->where('custom_fields', 'like', '%'.$fieldId.'%')
            ->select(['id', 'custom_fields'])
            ->chunkById(200, function (Collection $tasks) use ($fieldId, $optionIds) {
                foreach ($tasks as $task) {
                    $values = $task->custom_fields ?? [];

                    if (! array_key_exists($fieldId, $values)) {
                        continue;
                    }

                    $current = $values[$fieldId];

                    if ($optionIds === null) {
                        unset($values[$fieldId]);
                    } elseif (is_array($current)) {
                        $remaining = array_values(array_diff($current, $optionIds));
                        if ($remaining === $current) {
                            continue;
                        }
                        if ($remaining === []) {
                            unset($values[$fieldId]);
                        } else {
                            $values[$fieldId] = $remaining;
                        }
                    } elseif (in_array($current, $optionIds, true)) {
                        unset($values[$fieldId]);
                    } else {
                        continue;
                    }

                    // A query update skips model events and updated_at: this
                    // is housekeeping, not an edit of the task.
                    Task::whereKey($task->id)->update([
                        'custom_fields' => $values === [] ? null : json_encode($values),
                    ]);
                }
            });
    }

    /**
     * Order stored values by the board's field order (stable JSON).
     *
     * @param  array<string, mixed>  $values
     * @param  Collection<string, BoardCustomField>  $fields
     * @return array<string, mixed>
     */
    private static function ordered(array $values, Collection $fields): array
    {
        $ordered = [];

        foreach ($fields->keys() as $id) {
            if (array_key_exists($id, $values)) {
                $ordered[$id] = $values[$id];
            }
        }

        return $ordered;
    }
}
