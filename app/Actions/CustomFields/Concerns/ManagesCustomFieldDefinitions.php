<?php

namespace App\Actions\CustomFields\Concerns;

use App\Events\BoardChanged;
use App\Models\Board;
use App\Models\BoardCustomField;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

trait ManagesCustomFieldDefinitions
{
    /** Default color for a select option created without one (slate). */
    protected string $defaultOptionColor = '#64748b';

    /**
     * Field names are unique per board (case-insensitive) so people — and
     * API clients — can tell fields apart.
     *
     * @throws ValidationException
     */
    protected function assertUniqueName(Board $board, string $name, ?string $ignoreId = null): void
    {
        $taken = $board->customFields()
            ->when($ignoreId, fn ($query) => $query->whereKeyNot($ignoreId))
            ->get(['id', 'name'])
            ->contains(fn (BoardCustomField $field) => mb_strtolower($field->name) === mb_strtolower($name));

        if ($taken) {
            throw ValidationException::withMessages([
                'name' => ["This board already has a field named “{$name}”."],
            ]);
        }
    }

    /**
     * Normalize select options to `{id, label, color}`. Ids of existing
     * options are kept (so task values survive a relabel); anything else
     * gets a fresh id.
     *
     * @param  array<int, array<string, mixed>>  $options
     * @param  array<int, string>  $existingIds
     * @return array<int, array{id: string, label: string, color: string}>
     *
     * @throws ValidationException
     */
    protected function normalizeOptions(array $options, array $existingIds = []): array
    {
        $normalized = [];
        $usedIds = [];
        $labels = [];

        foreach (array_values($options) as $index => $option) {
            $label = trim((string) ($option['label'] ?? ''));

            if ($label === '') {
                throw ValidationException::withMessages([
                    "options.{$index}.label" => ['Each option needs a label.'],
                ]);
            }

            $key = mb_strtolower($label);
            if (isset($labels[$key])) {
                throw ValidationException::withMessages([
                    "options.{$index}.label" => ["“{$label}” is listed more than once."],
                ]);
            }
            $labels[$key] = true;

            $id = $option['id'] ?? null;
            if (! is_string($id) || ! in_array($id, $existingIds, true) || isset($usedIds[$id])) {
                $id = Str::lower(Str::random(10));
            }
            $usedIds[$id] = true;

            $normalized[] = [
                'id' => $id,
                'label' => $label,
                'color' => $option['color'] ?? $this->defaultOptionColor,
            ];
        }

        return $normalized;
    }

    /**
     * Tell other viewers of the board to refresh its field definitions.
     */
    protected function broadcastFieldsChanged(Board $board, string $action, array $data = []): void
    {
        broadcast(new BoardChanged(
            boardId: $board->id,
            action: $action,
            data: $data,
            userId: Auth::id() ?? 'system',
        ))->toOthers();
    }
}
