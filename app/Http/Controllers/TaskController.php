<?php

namespace App\Http\Controllers;

use App\Actions\Tasks\AssignTask;
use App\Actions\Tasks\CreateTask;
use App\Actions\Tasks\DeleteTask;
use App\Actions\Tasks\MoveTask;
use App\Actions\Tasks\SyncTaskLabels;
use App\Actions\Tasks\UpdateTask;
use App\Http\Requests\MoveTaskRequest;
use App\Http\Requests\StoreTaskRequest;
use App\Http\Requests\UpdateTaskRequest;
use App\Models\Board;
use App\Models\Column;
use App\Models\Task;
use App\Models\Team;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Redirect;
use Inertia\Inertia;
use Inertia\Response;

class TaskController extends Controller
{
    /**
     * Store a newly created task in the column.
     */
    public function store(StoreTaskRequest $request, Team $team, Board $board, Column $column): RedirectResponse
    {
        $this->authorize('create', [Task::class, $board]);

        CreateTask::run($board, $column, $request->validated(), $request->user());

        return Redirect::back();
    }

    public function show(Team $team, Board $board, Task $task): JsonResponse|Response
    {
        $this->authorize('view', $task);

        $task->load([
            'assignees',
            'labels',
            'creator',
            'column',
            'comments.user',
            'activities.user',
            'attachments.user',
            'subtasks.assignees',
            'subtasks.labels',
            'gitlabLinks.gitlabProject',
        ]);
        $task->loadCount(['comments', 'subtasks']);

        if (request()->wantsJson()) {
            return response()->json($task);
        }

        return Inertia::render('Tasks/Show', [
            'team' => $team,
            'board' => $board,
            'task' => $task,
        ]);
    }

    /**
     * Update the specified task.
     */
    public function update(UpdateTaskRequest $request, Team $team, Board $board, Task $task): RedirectResponse
    {
        $this->authorize('update', $task);

        UpdateTask::run($task, $request->validated());

        return Redirect::back();
    }

    /**
     * Delete the specified task.
     */
    public function destroy(Team $team, Board $board, Task $task): RedirectResponse
    {
        $this->authorize('delete', $task);

        DeleteTask::run($task);

        return Redirect::back();
    }

    /**
     * Move a task to a different column or reorder within a column.
     */
    public function move(MoveTaskRequest $request, Team $team, Board $board, Task $task): RedirectResponse
    {
        $this->authorize('update', $task);

        $column = Column::findOrFail($request->validated('column_id'));
        MoveTask::run($task, $column, $request->validated('sort_order'));

        return Redirect::back();
    }

    /**
     * Update task assignees.
     */
    public function updateAssignees(Request $request, Team $team, Board $board, Task $task): RedirectResponse
    {
        $this->authorize('assign', $task);

        $validated = $request->validate([
            'user_ids' => ['present', 'array'],
            'user_ids.*' => ['uuid', 'exists:users,id'],
        ]);

        AssignTask::run($task, $validated['user_ids'], $request->user());

        return Redirect::back();
    }

    /**
     * Update task labels.
     */
    public function updateLabels(Request $request, Team $team, Board $board, Task $task): RedirectResponse
    {
        $this->authorize('update', $task);

        $validated = $request->validate([
            'label_ids' => ['present', 'array'],
            'label_ids.*' => ['uuid', 'exists:labels,id'],
        ]);

        SyncTaskLabels::run($task, $validated['label_ids']);

        return Redirect::back();
    }
}
