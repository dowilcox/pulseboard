<?php

namespace App\Actions\Automation;

use App\Models\AutomationRule;
use App\Models\Board;
use Lorisleiva\Actions\Concerns\AsAction;

class CreateAutomationRule
{
    use AsAction;

    /**
     * Create a new active automation rule for the given board.
     *
     * @param  array{name: string, trigger_type: string, trigger_config?: array, action_type: string, action_config?: array}  $data
     */
    public function handle(Board $board, array $data): AutomationRule
    {
        return $board->automationRules()->create([
            'name' => $data['name'],
            'trigger_type' => $data['trigger_type'],
            'trigger_config' => $data['trigger_config'] ?? [],
            'action_type' => $data['action_type'],
            'action_config' => $data['action_config'] ?? [],
            'is_active' => true,
        ]);
    }
}
