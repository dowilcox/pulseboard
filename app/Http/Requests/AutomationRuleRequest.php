<?php

namespace App\Http\Requests;

use App\Models\Board;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Validator as ValidatorFacade;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Illuminate\Validation\Validator;

abstract class AutomationRuleRequest extends FormRequest
{
    /**
     * The trigger config after validation against the trigger-type rules.
     */
    protected ?array $resolvedTriggerConfig = null;

    /**
     * The action config after validation against the action-type rules.
     */
    protected ?array $resolvedActionConfig = null;

    /**
     * Determine if the user is authorized to make this request.
     *
     * Authorization is handled by the controller via BoardPolicy.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Validate the trigger/action configs once the base rules pass.
     */
    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            if ($validator->errors()->isNotEmpty()) {
                return;
            }

            try {
                $this->resolveConfigs();
            } catch (ValidationException $e) {
                foreach ($e->errors() as $key => $messages) {
                    foreach ($messages as $message) {
                        $validator->errors()->add($key, $message);
                    }
                }
            }
        });
    }

    /**
     * Get the validated data, with trigger/action configs normalized to the
     * subset validated against their type-specific rules.
     */
    public function validated($key = null, $default = null)
    {
        $validated = parent::validated();

        if ($this->resolvedTriggerConfig !== null) {
            $validated['trigger_config'] = $this->resolvedTriggerConfig;
        }

        if ($this->resolvedActionConfig !== null) {
            $validated['action_config'] = $this->resolvedActionConfig;
        }

        if ($key !== null) {
            return data_get($validated, $key, $default);
        }

        return $validated;
    }

    /**
     * Validate the trigger/action configs and store the normalized results.
     *
     * @throws ValidationException
     */
    abstract protected function resolveConfigs(): void;

    protected function board(): Board
    {
        return $this->route('board');
    }

    /**
     * @throws ValidationException
     */
    protected function validateTriggerConfig(Board $board, string $triggerType, array $config): array
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

    /**
     * @throws ValidationException
     */
    protected function validateActionConfig(Board $board, string $actionType, array $config): array
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
                            || ! ValidatorFacade::make(
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

    /**
     * @throws ValidationException
     */
    private function validateConfig(array $config, array $rules, string $prefix): array
    {
        if ($rules === []) {
            return $config;
        }

        try {
            return ValidatorFacade::make($config, $rules)->validate();
        } catch (ValidationException $e) {
            $prefixed = [];
            foreach ($e->errors() as $key => $messages) {
                $prefixed["{$prefix}.{$key}"] = $messages;
            }
            throw ValidationException::withMessages($prefixed);
        }
    }
}
