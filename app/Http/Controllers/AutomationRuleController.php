<?php

namespace App\Http\Controllers;

use App\Models\AutomationRule;
use App\Models\Board;
use App\Models\Team;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AutomationRuleController extends Controller
{
    public function index(Team $team, Board $board): JsonResponse
    {
        $this->authorize('update', $board);

        return response()->json(
            $board->automationRules()->orderBy('created_at')->get()
        );
    }

    public function store(Request $request, Team $team, Board $board): JsonResponse
    {
        $this->authorize('update', $board);

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'trigger_type' => ['required', 'string', 'in:task_moved,task_created,task_assigned,label_added,due_date_reached,gitlab_mr_merged,gitlab_pipeline_status'],
            'trigger_config' => ['sometimes', 'array'],
            'action_type' => ['required', 'string', 'in:move_to_column,assign_user,add_label,send_notification,update_field'],
            'action_config' => ['sometimes', 'array'],
        ]);

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
        $this->authorize('update', $board);

        $validated = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'trigger_type' => ['sometimes', 'string', 'in:task_moved,task_created,task_assigned,label_added,due_date_reached,gitlab_mr_merged,gitlab_pipeline_status'],
            'trigger_config' => ['sometimes', 'array'],
            'action_type' => ['sometimes', 'string', 'in:move_to_column,assign_user,add_label,send_notification,update_field'],
            'action_config' => ['sometimes', 'array'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        $automationRule->update($validated);

        return response()->json($automationRule->fresh());
    }

    public function destroy(Team $team, Board $board, AutomationRule $automationRule): JsonResponse
    {
        $this->authorize('update', $board);

        $automationRule->delete();

        return response()->json(['message' => 'Automation rule deleted']);
    }
}
