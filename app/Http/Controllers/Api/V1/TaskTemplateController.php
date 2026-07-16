<?php

namespace App\Http\Controllers\Api\V1;

use App\Actions\Tasks\CreateTaskFromTemplate;
use App\Actions\Tasks\CreateTaskTemplate;
use App\Actions\Tasks\DeleteTaskTemplate;
use App\Http\Controllers\Controller;
use App\Models\Board;
use App\Models\Column;
use App\Models\Task;
use App\Models\TaskTemplate;
use App\Models\Team;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class TaskTemplateController extends Controller
{
    public function index(Team $team): JsonResponse
    {
        $this->authorize('view', $team);

        $templates = TaskTemplate::where('team_id', $team->id)
            ->with('creator')
            ->orderBy('name')
            ->get();

        return response()->json(['data' => $templates]);
    }

    public function store(Request $request, Team $team): JsonResponse
    {
        $this->authorize('update', $team);

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'description_template' => ['nullable', 'string'],
            'priority' => ['sometimes', Rule::in(['urgent', 'high', 'medium', 'low', 'none'])],
            'effort_estimate' => ['nullable', 'integer', 'min:0'],
            'checklists' => ['nullable', 'array'],
            'label_ids' => ['nullable', 'array'],
            'label_ids.*' => ['uuid'],
        ]);

        $validated['created_by'] = $request->user()->id;

        $template = CreateTaskTemplate::run($team, $validated);

        return response()->json(['data' => $template], 201);
    }

    public function destroy(Team $team, TaskTemplate $taskTemplate): JsonResponse
    {
        $this->authorize('update', $team);
        abort_unless($taskTemplate->team_id === $team->id, 404);

        DeleteTaskTemplate::run($taskTemplate);

        return response()->json(null, 204);
    }

    public function createFromTask(Request $request, Team $team, Board $board, Task $task): JsonResponse
    {
        $this->authorize('update', $team);

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
        ]);

        $template = CreateTaskTemplate::run($team, [
            'name' => $validated['name'],
            'description_template' => $task->description,
            'priority' => $task->priority ?? 'none',
            'effort_estimate' => $task->effort_estimate,
            'checklists' => $task->checklists,
            'label_ids' => $task->labels->pluck('id')->toArray(),
            'created_by' => $request->user()->id,
        ]);

        return response()->json(['data' => $template], 201);
    }

    public function createTask(Request $request, Team $team, Board $board, Column $column, TaskTemplate $taskTemplate): JsonResponse
    {
        $this->authorize('create', [Task::class, $board]);
        abort_unless($taskTemplate->team_id === $team->id, 404);

        $validated = $request->validate([
            'title' => ['sometimes', 'string', 'max:255'],
        ]);

        $task = CreateTaskFromTemplate::run(
            $taskTemplate,
            $column,
            $request->user(),
            $validated['title'] ?? null,
        );

        return response()->json(['data' => $task], 201);
    }
}
