<?php

namespace App\Actions\Automation;

use App\Models\AutomationRule;
use Lorisleiva\Actions\Concerns\AsAction;

class UpdateAutomationRule
{
    use AsAction;

    /**
     * Update the given automation rule.
     *
     * @param  array{name?: string, trigger_type?: string, trigger_config?: array, action_type?: string, action_config?: array, is_active?: bool}  $data
     */
    public function handle(AutomationRule $automationRule, array $data): AutomationRule
    {
        $automationRule->update($data);

        return $automationRule->fresh();
    }
}
