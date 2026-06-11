<?php

namespace App\Http\Requests;

use App\Models\AutomationRule;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Validation\Rule;

class UpdateAutomationRuleRequest extends AutomationRuleRequest
{
    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'name' => ['sometimes', 'string', 'max:255'],
            'trigger_type' => ['sometimes', 'string', Rule::in(AutomationRule::TRIGGER_TYPES)],
            'trigger_config' => ['sometimes', 'array'],
            'action_type' => ['sometimes', 'string', Rule::in(AutomationRule::ACTION_TYPES)],
            'action_config' => ['sometimes', 'array'],
            'is_active' => ['sometimes', 'boolean'],
        ];
    }

    protected function resolveConfigs(): void
    {
        $board = $this->board();

        /** @var AutomationRule $automationRule */
        $automationRule = $this->route('automationRule');

        if ($this->exists('trigger_config') || $this->exists('trigger_type')) {
            $this->resolvedTriggerConfig = $this->validateTriggerConfig(
                $board,
                $this->input('trigger_type') ?? $automationRule->trigger_type,
                $this->input('trigger_config') ?? $automationRule->trigger_config ?? [],
            );
        }

        if ($this->exists('action_config') || $this->exists('action_type')) {
            $this->resolvedActionConfig = $this->validateActionConfig(
                $board,
                $this->input('action_type') ?? $automationRule->action_type,
                $this->input('action_config') ?? $automationRule->action_config ?? [],
            );
        }
    }
}
