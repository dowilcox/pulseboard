<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AutomationRule extends Model
{
    use HasUuids;

    /**
     * Canonical list of supported trigger types.
     *
     * Must stay in sync with the trigger matchers in
     * \App\Actions\Automation\ExecuteAutomationRules::matchesTrigger().
     *
     * @var list<string>
     */
    public const TRIGGER_TYPES = [
        'task_moved',
        'task_created',
        'task_assigned',
        'label_added',
        'due_date_reached',
        'gitlab_mr_merged',
        'gitlab_pipeline_status',
        'task_completed',
        'task_uncompleted',
        'priority_changed',
        'comment_added',
    ];

    /**
     * Canonical list of supported action types.
     *
     * Must stay in sync with the action executors in
     * \App\Actions\Automation\ExecuteAutomationRules::executeAction().
     *
     * @var list<string>
     */
    public const ACTION_TYPES = [
        'move_to_column',
        'assign_user',
        'add_label',
        'update_field',
        'mark_complete',
        'mark_incomplete',
        'remove_label',
        'unassign_user',
        'send_notification',
        'add_watcher',
        'remove_watcher',
    ];

    public $incrementing = false;

    protected $keyType = 'string';

    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
            'trigger_config' => 'array',
            'action_config' => 'array',
        ];
    }

    public function board(): BelongsTo
    {
        return $this->belongsTo(Board::class);
    }
}
