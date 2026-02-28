<?php

namespace App\Http\Controllers;

use App\Actions\Tasks\AddTaskDependency;
use App\Actions\Tasks\RemoveTaskDependency;
use App\Models\Task;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Redirect;

class TaskDependencyController extends Controller
{
    public function store(Request $request, Task $task): RedirectResponse
    {
        $this->authorize('update', $task);

        $validated = $request->validate([
            'depends_on_task_id' => ['required', 'uuid', 'exists:tasks,id'],
        ]);

        $dependsOn = Task::findOrFail($validated['depends_on_task_id']);

        AddTaskDependency::run($task, $dependsOn, $request->user());

        return Redirect::back();
    }

    public function destroy(Request $request, Task $task, Task $dependsOnTask): RedirectResponse
    {
        $this->authorize('update', $task);

        RemoveTaskDependency::run($task, $dependsOnTask, $request->user());

        return Redirect::back();
    }
}
