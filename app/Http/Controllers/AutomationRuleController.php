<?php

namespace App\Http\Controllers;

use App\Actions\Automation\CreateAutomationRule;
use App\Actions\Automation\UpdateAutomationRule;
use App\Http\Requests\StoreAutomationRuleRequest;
use App\Http\Requests\UpdateAutomationRuleRequest;
use App\Models\AutomationRule;
use App\Models\Board;
use App\Models\Team;
use Illuminate\Http\JsonResponse;

class AutomationRuleController extends Controller
{
    public function index(Team $team, Board $board): JsonResponse
    {
        $this->authorize('update', $board);

        return response()->json(
            $board->automationRules()->orderBy('created_at')->get()
        );
    }

    public function store(StoreAutomationRuleRequest $request, Team $team, Board $board): JsonResponse
    {
        $this->authorize('update', $board);

        $rule = CreateAutomationRule::run($board, $request->validated());

        return response()->json($rule, 201);
    }

    public function update(UpdateAutomationRuleRequest $request, Team $team, Board $board, AutomationRule $automationRule): JsonResponse
    {
        abort_unless($automationRule->board_id === $board->id, 404);
        $this->authorize('update', $board);

        $rule = UpdateAutomationRule::run($automationRule, $request->validated());

        return response()->json($rule);
    }

    public function destroy(Team $team, Board $board, AutomationRule $automationRule): JsonResponse
    {
        abort_unless($automationRule->board_id === $board->id, 404);
        $this->authorize('update', $board);

        $automationRule->delete();

        return response()->json(['message' => 'Automation rule deleted']);
    }
}
