<?php

namespace App\Http\Requests;

use App\Models\AutomationRule;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Validation\Rule;

class StoreAutomationRuleRequest extends AutomationRuleRequest
{
    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255'],
            'trigger_type' => ['required', 'string', Rule::in(AutomationRule::TRIGGER_TYPES)],
            'trigger_config' => ['sometimes', 'array'],
            'action_type' => ['required', 'string', Rule::in(AutomationRule::ACTION_TYPES)],
            'action_config' => ['sometimes', 'array'],
        ];
    }

    protected function resolveConfigs(): void
    {
        $board = $this->board();

        $this->resolvedTriggerConfig = $this->validateTriggerConfig(
            $board,
            $this->input('trigger_type'),
            $this->input('trigger_config') ?? [],
        );

        $this->resolvedActionConfig = $this->validateActionConfig(
            $board,
            $this->input('action_type'),
            $this->input('action_config') ?? [],
        );
    }
}
