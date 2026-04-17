<?php

namespace App\Http\Controllers;

use App\Models\AutomationRule;
use App\Models\Board;
use App\Models\Team;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class AutomationRuleController extends Controller
{
    public function index(Team $team, Board $board): JsonResponse
    {
        abort_unless($board->team_id === $team->id, 404);
        $this->authorize('update', $board);

        return response()->json(
            $board->automationRules()->orderBy('created_at')->get()
        );
    }

    public function store(Request $request, Team $team, Board $board): JsonResponse
    {
        abort_unless($board->team_id === $team->id, 404);
        $this->authorize('update', $board);

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'trigger_type' => ['required', 'string', 'in:task_moved,task_created,task_assigned,label_added,due_date_reached,gitlab_mr_merged,gitlab_pipeline_status,task_completed,task_uncompleted,priority_changed,comment_added'],
            'trigger_config' => ['sometimes', 'array'],
            'action_type' => ['required', 'string', 'in:move_to_column,assign_user,add_label,update_field,mark_complete,mark_incomplete,remove_label,unassign_user,send_notification,add_watcher,remove_watcher'],
            'action_config' => ['sometimes', 'array'],
        ]);

        $validated['trigger_config'] = $this->validateTriggerConfig(
            $board,
            $validated['trigger_type'],
            $validated['trigger_config'] ?? [],
        );
        $validated['action_config'] = $this->validateActionConfig(
            $board,
            $validated['action_type'],
            $validated['action_config'] ?? [],
        );

        $rule = $board->automationRules()->create([
            'name' => $validated['name'],
            'trigger_type' => $validated['trigger_type'],
            'trigger_config' => $validated['trigger_config'] ?? [],
            'action_type' => $validated['action_type'],
            'action_config' => $validated['action_config'] ?? [],
            'is_active' => true,
        ]);

        return response()->json($rule, 201);
    }

    public function update(Request $request, Team $team, Board $board, AutomationRule $automationRule): JsonResponse
    {
        abort_unless($board->team_id === $team->id, 404);
        abort_unless($automationRule->board_id === $board->id, 404);
        $this->authorize('update', $board);

        $validated = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'trigger_type' => ['sometimes', 'string', 'in:task_moved,task_created,task_assigned,label_added,due_date_reached,gitlab_mr_merged,gitlab_pipeline_status,task_completed,task_uncompleted,priority_changed,comment_added'],
            'trigger_config' => ['sometimes', 'array'],
            'action_type' => ['sometimes', 'string', 'in:move_to_column,assign_user,add_label,update_field,mark_complete,mark_incomplete,remove_label,unassign_user,send_notification,add_watcher,remove_watcher'],
            'action_config' => ['sometimes', 'array'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        if (array_key_exists('trigger_config', $validated) || array_key_exists('trigger_type', $validated)) {
            $validated['trigger_config'] = $this->validateTriggerConfig(
                $board,
                $validated['trigger_type'] ?? $automationRule->trigger_type,
                $validated['trigger_config'] ?? $automationRule->trigger_config ?? [],
            );
        }

        if (array_key_exists('action_config', $validated) || array_key_exists('action_type', $validated)) {
            $validated['action_config'] = $this->validateActionConfig(
                $board,
                $validated['action_type'] ?? $automationRule->action_type,
                $validated['action_config'] ?? $automationRule->action_config ?? [],
            );
        }

        $automationRule->update($validated);

        return response()->json($automationRule->fresh());
    }

    public function destroy(Team $team, Board $board, AutomationRule $automationRule): JsonResponse
    {
        abort_unless($board->team_id === $team->id, 404);
        abort_unless($automationRule->board_id === $board->id, 404);
        $this->authorize('update', $board);

        $automationRule->delete();

        return response()->json(['message' => 'Automation rule deleted']);
    }

    private function validateTriggerConfig(Board $board, string $triggerType, array $config): array
    {
        $teamId = $board->team_id;
        $rules = match ($triggerType) {
            'task_moved' => [
                'from_column_id' => ['nullable', 'uuid', Rule::exists('columns', 'id')->where(fn ($query) => $query->where('board_id', $board->id))],
                'to_column_id' => ['nullable', 'uuid', Rule::exists('columns', 'id')->where(fn ($query) => $query->where('board_id', $board->id))],
            ],
            'task_assigned' => [
                'user_id' => ['nullable', 'uuid', Rule::exists('team_members', 'user_id')->where(fn ($query) => $query->where('team_id', $teamId))],
            ],
            'label_added' => [
                'label_id' => ['nullable', 'uuid', Rule::exists('labels', 'id')->where(fn ($query) => $query->where('team_id', $teamId))],
            ],
            'gitlab_pipeline_status' => [
                'status' => ['nullable', 'string', 'max:50'],
            ],
            'priority_changed' => [
                'priority' => ['nullable', 'string', Rule::in(['urgent', 'high', 'medium', 'low', 'none'])],
            ],
            default => [],
        };

        return $this->validateConfig($config, $rules, 'trigger_config');
    }

    private function validateActionConfig(Board $board, string $actionType, array $config): array
    {
        $teamId = $board->team_id;

        $rules = match ($actionType) {
            'move_to_column' => [
                'column_id' => ['required', 'uuid', Rule::exists('columns', 'id')->where(fn ($query) => $query->where('board_id', $board->id))],
            ],
            'assign_user', 'unassign_user', 'add_watcher', 'remove_watcher' => [
                'user_id' => ['required', 'uuid', Rule::exists('team_members', 'user_id')->where(fn ($query) => $query->where('team_id', $teamId))],
            ],
            'add_label', 'remove_label' => [
                'label_id' => ['required', 'uuid', Rule::exists('labels', 'id')->where(fn ($query) => $query->where('team_id', $teamId))],
            ],
            'send_notification' => [
                'target' => [
                    'required',
                    'string',
                    function (string $attribute, mixed $value, \Closure $fail) use ($teamId): void {
                        if (in_array($value, ['assignees', 'watchers', 'creator'], true)) {
                            return;
                        }

                        if (
                            ! is_string($value)
                            || ! Validator::make(
                                ['target' => $value],
                                ['target' => ['uuid', Rule::exists('team_members', 'user_id')->where(fn ($query) => $query->where('team_id', $teamId))]],
                            )->passes()
                        ) {
                            $fail('The selected notification target is invalid.');
                        }
                    },
                ],
                'message' => ['nullable', 'string', 'max:1000'],
            ],
            'update_field' => $this->updateFieldRules($config),
            default => [],
        };

        return $this->validateConfig($config, $rules, 'action_config');
    }

    private function updateFieldRules(array $config): array
    {
        $field = $config['field'] ?? null;

        $valueRules = match ($field) {
            'priority' => ['required', 'string', Rule::in(['urgent', 'high', 'medium', 'low', 'none'])],
            'due_date' => ['required', 'date'],
            'effort_estimate' => ['required', 'integer', 'min:0'],
            default => ['required'],
        };

        return [
            'field' => ['required', 'string', Rule::in(['priority', 'due_date', 'effort_estimate'])],
            'value' => $valueRules,
        ];
    }

    private function validateConfig(array $config, array $rules, string $prefix): array
    {
        if ($rules === []) {
            return $config;
        }

        try {
            return Validator::make($config, $rules)->validate();
        } catch (ValidationException $e) {
            $prefixed = [];
            foreach ($e->errors() as $key => $messages) {
                $prefixed["{$prefix}.{$key}"] = $messages;
            }
            throw ValidationException::withMessages($prefixed);
        }
    }
}
