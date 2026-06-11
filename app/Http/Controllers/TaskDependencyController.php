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
use Illuminate\Support\Str;

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

    public function destroy(Request $request, Team $team, Board $board, Task $task, string $dependsOnTask): RedirectResponse
    {
        $this->authorize('update', $task);

        // Resolve manually instead of via implicit route binding: the
        // depends-on task may live on another board within the same team,
        // and Task::resolveRouteBinding() scopes lookups to the route board.
        $dependsOn = $this->resolveDependsOnTask($dependsOnTask, $board);

        if ($dependsOn->board->team_id !== $task->board->team_id) {
            abort(404);
        }

        RemoveTaskDependency::run($task, $dependsOn, $request->user());

        return Redirect::back();
    }

    private function resolveDependsOnTask(string $value, Board $board): Task
    {
        if (Str::isUuid($value)) {
            return Task::findOrFail($value);
        }

        // {number}-{slug} URLs are board-scoped, so fall back to the route board.
        $taskNumber = (int) $value;
        abort_if($taskNumber <= 0, 404);

        return Task::where('board_id', $board->id)
            ->where('task_number', $taskNumber)
            ->firstOrFail();
    }
}
