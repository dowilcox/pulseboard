<?php

namespace App\Http\Controllers;

use App\Actions\Tasks\CreateTaskFromTemplate;
use App\Actions\Tasks\CreateTaskTemplate;
use App\Actions\Tasks\DeleteTaskTemplate;
use App\Models\Board;
use App\Models\Column;
use App\Models\Task;
use App\Models\TaskTemplate;
use App\Models\Team;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Redirect;
use Illuminate\Validation\Rule;

class TaskTemplateController extends Controller
{
    public function index(Team $team): JsonResponse
    {
        $templates = TaskTemplate::where('team_id', $team->id)
            ->with('creator')
            ->orderBy('name')
            ->get();

        return response()->json($templates);
    }

    public function store(Request $request, Team $team): RedirectResponse
    {
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

        CreateTaskTemplate::run($team, $validated);

        return Redirect::back();
    }

    public function destroy(Team $team, TaskTemplate $taskTemplate): RedirectResponse
    {
        DeleteTaskTemplate::run($taskTemplate);

        return Redirect::back();
    }

    public function createFromTask(Request $request, Team $team, Board $board, Task $task): RedirectResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
        ]);

        CreateTaskTemplate::run($team, [
            'name' => $validated['name'],
            'description_template' => $task->description,
            'priority' => $task->priority ?? 'none',
            'effort_estimate' => $task->effort_estimate,
            'checklists' => $task->checklists,
            'label_ids' => $task->labels->pluck('id')->toArray(),
            'created_by' => $request->user()->id,
        ]);

        return Redirect::back();
    }

    public function createTask(Request $request, Team $team, Board $board, Column $column, TaskTemplate $taskTemplate): RedirectResponse
    {
        CreateTaskFromTemplate::run($taskTemplate, $column, $request->user());

        return Redirect::back();
    }
}
