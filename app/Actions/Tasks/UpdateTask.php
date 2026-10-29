<?php

namespace App\Actions\Tasks;

use App\Models\Task;
use App\Notifications\DescriptionMentionedNotification;
use App\Services\ActivityLogger;
use App\Services\MentionParser;
use App\Support\CustomFieldValues;
use App\Support\RichTextSanitizer;
use Carbon\Carbon;
use Illuminate\Support\Facades\Auth;
use Lorisleiva\Actions\Concerns\AsAction;

class UpdateTask
{
    use AsAction;

    public function handle(Task $task, array $data): Task
    {
        $fillable = [
            'title',
            'description',
            'priority',
            'due_date',
            'effort_estimate',
            'custom_fields',
            'checklists',
            'links',
            'recurrence_config',
        ];
        $changes = [];

        // Custom field updates are partial: validate the incoming values
        // against the board's definitions and merge them over the stored
        // ones, so saving one field never wipes the others.
        if (array_key_exists('custom_fields', $data)) {
            $task->loadMissing('board');
            $data['custom_fields'] = CustomFieldValues::merge(
                $task->board,
                $data['custom_fields'],
                $task->custom_fields,
            );
        }

        foreach ($fillable as $field) {
            if (! array_key_exists($field, $data)) {
                continue;
            }

            // Log only the custom fields that changed, not the whole map.
            if ($field === 'custom_fields') {
                $diff = $this->customFieldChanges(
                    $task->custom_fields ?? [],
                    $data['custom_fields'] ?? [],
                );

                if ($diff !== null) {
                    $changes[$field] = $diff;
                }

                continue;
            }

            // due_date is cast `date:Y-m-d` (Carbon), so compare normalized
            // date strings — a raw comparison against the request string
            // would always report a change.
            if ($field === 'due_date') {
                $from = $task->due_date?->toDateString();
                $to = ! empty($data['due_date'])
                    ? Carbon::parse($data['due_date'])->toDateString()
                    : null;

                if ($from !== $to) {
                    $changes[$field] = ['from' => $from, 'to' => $to];
                }

                continue;
            }

            if ($task->{$field} != $data[$field]) {
                $changes[$field] = [
                    'from' => $task->{$field},
                    'to' => $data[$field],
                ];
            }
        }

        // Capture old description before update for mention diffing
        $oldDescription = $task->description;

        $updateData = array_intersect_key($data, array_flip($fillable));

        if (array_key_exists('description', $updateData)) {
            $updateData['description'] = RichTextSanitizer::sanitize(
                $updateData['description'],
            );
        }

        // Compute recurrence_next_at when recurrence_config is provided
        if (array_key_exists('recurrence_config', $data)) {
            $updateData['recurrence_next_at'] = $this->computeNextRecurrence(
                $data['recurrence_config'],
            );
        }

        $task->update($updateData);

        if (! empty($changes)) {
            ActivityLogger::log($task, 'field_changed', $changes);
        }

        // Notify newly-mentioned users in description
        if (
            isset($changes['description']) &&
            ! empty($updateData['description'])
        ) {
            $this->notifyDescriptionMentions(
                $task,
                $oldDescription,
                $updateData['description'],
            );
        }

        return $task->fresh();
    }

    /**
     * The custom field values that differ between two value maps, as
     * `{from: {id: old}, to: {id: new}}`, or null when nothing changed.
     *
     * @param  array<string, mixed>  $from
     * @param  array<string, mixed>  $to
     */
    private function customFieldChanges(array $from, array $to): ?array
    {
        $diff = ['from' => [], 'to' => []];

        foreach (array_unique([...array_keys($from), ...array_keys($to)]) as $id) {
            $old = $from[$id] ?? null;
            $new = $to[$id] ?? null;

            if ($old !== $new) {
                $diff['from'][$id] = $old;
                $diff['to'][$id] = $new;
            }
        }

        return $diff['to'] === [] ? null : $diff;
    }

    private function notifyDescriptionMentions(Task $task, ?string $oldDescription, string $newDescription): void
    {
        $actor = Auth::user();
        if (! $actor) {
            return;
        }

        $task->loadMissing('board.team');

        $newMentions = MentionParser::findNewMentions(
            $oldDescription,
            $newDescription,
            [$actor->id],
            $task->board->team,
        );

        foreach ($newMentions as $user) {
            $notification = new DescriptionMentionedNotification($task, $actor);
            $user->notify($notification);

            ActivityLogger::broadcastDatabaseNotification(
                $user,
                $notification,
                "{$actor->name} mentioned you in the description of \"{$task->title}\"",
                'DescriptionMentionedNotification',
            );
        }
    }

    private function computeNextRecurrence(?array $config): ?Carbon
    {
        if (! $config || empty($config['frequency'])) {
            return null;
        }

        $interval = $config['interval'] ?? 1;

        return match ($config['frequency']) {
            'daily' => now()->addDays($interval),
            'weekly' => now()->addWeeks($interval),
            'monthly' => now()->addMonths($interval),
            'custom' => now()->addDays($interval),
            default => null,
        };
    }
}
