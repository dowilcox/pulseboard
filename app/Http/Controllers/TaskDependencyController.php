<?php

namespace App\Http\Controllers;

use App\Actions\Tasks\AddTaskDependency;
use App\Actions\Tasks\RemoveTaskDependency;
use App\Models\Board;
use App\Models\Task;
use App\Models\Team;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Redirect;

class TaskDependencyController extends Controller
{
    public function store(Request $request, Team $team, Board $board, Task $task): RedirectResponse
    {
        $this->authorize('update', $task);

        $validated = $request->validate([
            'depends_on_task_id' => ['required', 'uuid', 'exists:tasks,id'],
        ]);

        $dependsOn = Task::findOrFail($validated['depends_on_task_id']);

        if ($dependsOn->board->team_id !== $task->board->team_id) {
            abort(422, 'The dependency task must belong to the same team.');
        }

        AddTaskDependency::run($task, $dependsOn, $request->user());

        return Redirect::back();
    }

    public function destroy(Request $request, Team $team, Board $board, Task $task, Task $dependsOnTask): RedirectResponse
    {
        $this->authorize('update', $task);

        RemoveTaskDependency::run($task, $dependsOnTask, $request->user());

        return Redirect::back();
    }
}
