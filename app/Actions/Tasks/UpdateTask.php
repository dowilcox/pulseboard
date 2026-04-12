<?php

namespace App\Actions\Tasks;

use App\Events\NotificationCreated;
use App\Models\Task;
use App\Notifications\DescriptionMentionedNotification;
use App\Services\ActivityLogger;
use App\Services\MentionParser;
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

        foreach ($fillable as $field) {
            if (
                array_key_exists($field, $data) &&
                $task->{$field} != $data[$field]
            ) {
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

    private function notifyDescriptionMentions(Task $task, ?string $oldDescription, string $newDescription): void
    {
        $actor = Auth::user();
        if (! $actor) {
            return;
        }

        $newMentions = MentionParser::findNewMentions(
            $oldDescription,
            $newDescription,
            [$actor->id],
        );

        $task->loadMissing('board.team');

        foreach ($newMentions as $user) {
            $notification = new DescriptionMentionedNotification($task, $actor);
            $user->notify($notification);

            $dbNotification = $user->notifications()->latest()->first();
            if ($dbNotification) {
                broadcast(new NotificationCreated(
                    userId: $user->id,
                    notificationId: $dbNotification->id,
                    type: 'DescriptionMentionedNotification',
                    message: "{$actor->name} mentioned you in the description of \"{$task->title}\"",
                ));
            }
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
