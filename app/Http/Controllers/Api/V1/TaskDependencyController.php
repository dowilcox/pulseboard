<?php

namespace App\Http\Controllers\Api\V1;

use App\Actions\Tasks\AddTaskDependency;
use App\Actions\Tasks\RemoveTaskDependency;
use App\Http\Controllers\Controller;
use App\Models\Board;
use App\Models\Task;
use App\Models\Team;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class TaskDependencyController extends Controller
{
    public function store(Request $request, Team $team, Board $board, Task $task): JsonResponse
    {
        $this->authorize('update', $task);

        $validated = $request->validate([
            'depends_on_task_id' => ['required', 'uuid', 'exists:tasks,id'],
        ]);

        $dependsOn = Task::findOrFail($validated['depends_on_task_id']);

        if ($dependsOn->board->team_id !== $task->board->team_id) {
            abort(422, 'The dependency task must belong to the same team.');
        }

        // Duplicate and circular-dependency validation lives in the action
        // so web and API behave identically.
        $dependency = AddTaskDependency::run($task, $dependsOn, $request->user());

        return response()->json(['data' => $dependency], 201);
    }

    public function destroy(Request $request, Team $team, Board $board, Task $task, string $dependsOnTask): JsonResponse
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

        return response()->json(null, 204);
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
