<?php

namespace App\Actions\Automation;

use App\Events\NotificationCreated;
use App\Models\AutomationRule;
use App\Models\Board;
use App\Models\Column;
use App\Models\Task;
use App\Models\User;
use App\Notifications\AutomationNotification;
use Illuminate\Support\Facades\Log;
use Lorisleiva\Actions\Concerns\AsAction;

class ExecuteAutomationRules
{
    use AsAction;

    /**
     * Execute active automation rules for a board based on a trigger event.
     *
     * @param  string  $triggerType  The event trigger type
     * @param  array  $context  Contextual data about the event
     */
    public function handle(Board $board, string $triggerType, array $context = []): void
    {
        $rules = $board->automationRules()
            ->where('is_active', true)
            ->where('trigger_type', $triggerType)
            ->get();

        foreach ($rules as $rule) {
            try {
                if ($this->matchesTrigger($rule, $context)) {
                    $this->executeAction($rule, $context);
                }
            } catch (\Throwable $e) {
                Log::warning('Automation rule execution failed', [
                    'rule_id' => $rule->id,
                    'error' => $e->getMessage(),
                ]);
            }
        }
    }

    // ── Trigger matchers ────────────────────────────────────────────────

    private function matchesTrigger(AutomationRule $rule, array $context): bool
    {
        $config = $rule->trigger_config;

        return match ($rule->trigger_type) {
            'task_moved' => $this->matchTaskMoved($config, $context),
            'task_created' => true,
            'task_assigned' => $this->matchTaskAssigned($config, $context),
            'label_added' => $this->matchLabelAdded($config, $context),
            'due_date_reached' => true,
            'gitlab_mr_merged' => true,
            'gitlab_pipeline_status' => $this->matchPipelineStatus($config, $context),
            'task_completed' => true,
            'task_uncompleted' => true,
            'priority_changed' => $this->matchPriorityChanged($config, $context),
            'comment_added' => true,
            default => false,
        };
    }

    private function matchTaskMoved(array $config, array $context): bool
    {
        if (! empty($config['from_column_id']) && ($context['from_column_id'] ?? null) !== $config['from_column_id']) {
            return false;
        }
        if (! empty($config['to_column_id']) && ($context['to_column_id'] ?? null) !== $config['to_column_id']) {
            return false;
        }

        return true;
    }

    private function matchTaskAssigned(array $config, array $context): bool
    {
        if (! empty($config['user_id'])) {
            return ($context['user_id'] ?? null) === $config['user_id'];
        }

        return true;
    }

    private function matchLabelAdded(array $config, array $context): bool
    {
        if (! empty($config['label_id'])) {
            return ($context['label_id'] ?? null) === $config['label_id'];
        }

        return true;
    }

    private function matchPipelineStatus(array $config, array $context): bool
    {
        if (! empty($config['status'])) {
            return ($context['pipeline_status'] ?? null) === $config['status'];
        }

        return true;
    }

    private function matchPriorityChanged(array $config, array $context): bool
    {
        if (! empty($config['priority'])) {
            $newPriority = $context['priority']['to'] ?? null;

            return $newPriority === $config['priority'];
        }

        return true;
    }

    // ── Action executors ────────────────────────────────────────────────

    private function executeAction(AutomationRule $rule, array $context): void
    {
        $task = isset($context['task_id']) ? Task::find($context['task_id']) : null;
        if (! $task) {
            return;
        }

        $config = $rule->action_config;

        match ($rule->action_type) {
            'move_to_column' => $this->actionMoveToColumn($task, $config),
            'assign_user' => $this->actionAssignUser($task, $config),
            'add_label' => $this->actionAddLabel($task, $config),
            'update_field' => $this->actionUpdateField($task, $config),
            'mark_complete' => $this->actionMarkComplete($task),
            'mark_incomplete' => $this->actionMarkIncomplete($task),
            'remove_label' => $this->actionRemoveLabel($task, $config),
            'unassign_user' => $this->actionUnassignUser($task, $config),
            'send_notification' => $this->actionSendNotification($task, $config, $rule),
            default => null,
        };
    }

    private function actionMoveToColumn(Task $task, array $config): void
    {
        $columnId = $config['column_id'] ?? null;
        if (! $columnId) {
            return;
        }

        $column = Column::find($columnId);
        if (! $column || $column->board_id !== $task->board_id) {
            return;
        }

        $task->update(['column_id' => $columnId]);
    }

    private function actionAssignUser(Task $task, array $config): void
    {
        $userId = $config['user_id'] ?? null;
        if (! $userId) {
            return;
        }

        if (! $task->assignees()->where('users.id', $userId)->exists()) {
            $task->assignees()->attach($userId, [
                'assigned_at' => now(),
                'assigned_by' => $userId,
            ]);
        }
    }

    private function actionAddLabel(Task $task, array $config): void
    {
        $labelId = $config['label_id'] ?? null;
        if (! $labelId) {
            return;
        }

        if (! $task->labels()->where('labels.id', $labelId)->exists()) {
            $task->labels()->attach($labelId);
        }
    }

    private function actionUpdateField(Task $task, array $config): void
    {
        $field = $config['field'] ?? null;
        $value = $config['value'] ?? null;

        $allowedFields = ['priority', 'due_date', 'effort_estimate'];
        if (! $field || ! in_array($field, $allowedFields)) {
            return;
        }

        $task->update([$field => $value]);
    }

    private function actionMarkComplete(Task $task): void
    {
        if (! $task->completed_at) {
            $task->update(['completed_at' => now()]);
        }
    }

    private function actionMarkIncomplete(Task $task): void
    {
        if ($task->completed_at) {
            $task->update(['completed_at' => null]);
        }
    }

    private function actionRemoveLabel(Task $task, array $config): void
    {
        $labelId = $config['label_id'] ?? null;
        if (! $labelId) {
            return;
        }

        $task->labels()->detach($labelId);
    }

    private function actionUnassignUser(Task $task, array $config): void
    {
        $userId = $config['user_id'] ?? null;
        if (! $userId) {
            return;
        }

        $task->assignees()->detach($userId);
    }

    private function actionSendNotification(Task $task, array $config, AutomationRule $rule): void
    {
        $target = $config['target'] ?? 'assignees';
        $message = $config['message'] ?? "Automation \"{$rule->name}\" triggered on \"{$task->title}\"";

        $task->loadMissing('board.team');

        $users = match ($target) {
            'assignees' => $task->assignees()->get(),
            'creator' => collect($task->created_by ? [User::find($task->created_by)] : [])->filter(),
            default => collect(User::find($target) ? [User::find($target)] : [])->filter(),
        };

        foreach ($users as $user) {
            $notification = new AutomationNotification($task, $message);
            $user->notify($notification);

            $dbNotification = $user->notifications()->latest()->first();
            if ($dbNotification) {
                broadcast(new NotificationCreated(
                    userId: $user->id,
                    notificationId: $dbNotification->id,
                    type: 'AutomationNotification',
                    message: $message,
                ));
            }
        }
    }
}
