<?php

namespace App\Services;

use App\Actions\Automation\ExecuteAutomationRules;
use App\Models\Task;
use Illuminate\Support\Facades\Log;

class TaskAutomationDispatcher
{
    private const MAX_AUTOMATION_DEPTH = 3;

    private static int $automationDepth = 0;

    public function dispatch(Task $task, string $action, array $changes): void
    {
        if (self::$automationDepth >= self::MAX_AUTOMATION_DEPTH) {
            Log::warning('Automation cascade depth limit reached', [
                'task_id' => $task->id,
                'action' => $action,
                'depth' => self::$automationDepth,
            ]);

            return;
        }

        self::$automationDepth++;

        try {
            $this->runAutomationRules($task, $action, $changes);
        } finally {
            self::$automationDepth--;
        }
    }

    public static function currentDepth(): int
    {
        return self::$automationDepth;
    }

    private function runAutomationRules(
        Task $task,
        string $action,
        array $changes,
    ): void {
        $triggerMap = [
            'created' => 'task_created',
            'moved' => 'task_moved',
            'assigned' => 'task_assigned',
            'labels_changed' => 'label_added',
            'gitlab_mr_merged' => 'gitlab_mr_merged',
            'completed' => 'task_completed',
            'uncompleted' => 'task_uncompleted',
            'commented' => 'comment_added',
        ];

        $baseContext = array_merge($changes, ['task_id' => $task->id]);
        $triggerContexts = [];

        if ($action === 'assigned') {
            $userIds = array_values($changes['user_ids'] ?? []);

            if (! empty($userIds)) {
                $triggerContexts['task_assigned'] = array_map(
                    fn (string $userId) => array_merge($baseContext, ['user_id' => $userId]),
                    $userIds,
                );
            }
        } elseif ($action === 'labels_changed') {
            $labelIds = array_values($changes['added_label_ids'] ?? []);

            if (! empty($labelIds)) {
                $triggerContexts['label_added'] = array_map(
                    fn (string $labelId) => array_merge($baseContext, ['label_id' => $labelId]),
                    $labelIds,
                );
            }
        } elseif (isset($triggerMap[$action])) {
            $triggerContexts[$triggerMap[$action]] = [$baseContext];
        }

        if ($action === 'field_changed' && isset($changes['priority'])) {
            $triggerContexts['priority_changed'] = [$baseContext];
        }

        if (empty($triggerContexts)) {
            return;
        }

        foreach ($triggerContexts as $triggerType => $contexts) {
            foreach ($contexts as $context) {
                try {
                    ExecuteAutomationRules::run(
                        $task->board,
                        $triggerType,
                        $context,
                    );
                } catch (\Throwable $e) {
                    Log::warning('Automation execution failed', [
                        'task_id' => $task->id,
                        'trigger' => $triggerType,
                        'error' => $e->getMessage(),
                    ]);
                }
            }
        }
    }
}
