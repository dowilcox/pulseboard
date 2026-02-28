<?php

namespace App\Http\Controllers;

use App\Actions\Tasks\AssignTask;
use App\Actions\Tasks\CreateTask;
use App\Actions\Tasks\DeleteTask;
use App\Actions\Tasks\MoveTask;
use App\Actions\Tasks\SyncTaskLabels;
use App\Actions\Tasks\ToggleTaskCompletion;
use App\Actions\Tasks\UpdateTask;
use App\Actions\Tasks\UploadTaskImage;
use App\Http\Requests\MoveTaskRequest;
use App\Http\Requests\StoreTaskRequest;
use App\Http\Requests\UpdateTaskRequest;
use App\Models\Board;
use App\Models\Column;
use App\Models\Label;
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
            'dependencies',
            'blockedBy',
            'parentTask',
        ]);
        $task->loadCount([
            'comments',
            'subtasks',
            'subtasks as completed_subtasks_count' => function ($query) {
                $query->whereNotNull('completed_at');
            },
        ]);

        if (request()->wantsJson()) {
            return response()->json($task);
        }

        $board->load('columns');
        $members = $team->members()->get();
        $labels = Label::where('team_id', $team->id)->get();

        $gitlabProjects = $team->gitlabProjects()
            ->with('connection')
            ->get();

        // Get all tasks in this board for dependency autocomplete
        $boardTasks = Task::where('board_id', $board->id)
            ->select('id', 'task_number', 'title', 'column_id')
            ->get();

        return Inertia::render('Tasks/Show', [
            'team' => $team,
            'board' => $board,
            'task' => $task,
            'members' => $members,
            'labels' => $labels,
            'gitlabProjects' => $gitlabProjects,
            'boardTasks' => $boardTasks,
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

    /**
     * Toggle task completion status.
     */
    public function toggleComplete(Request $request, Team $team, Board $board, Task $task): RedirectResponse
    {
        $this->authorize('update', $task);

        ToggleTaskCompletion::run($task, $request->user());

        return Redirect::back();
    }

    /**
     * Upload an image for the task (e.g. for rich text editor).
     */
    public function uploadImage(Request $request, Team $team, Board $board, Task $task): JsonResponse
    {
        $this->authorize('update', $task);

        $request->validate([
            'image' => ['required', 'image', 'max:5120'],
        ]);

        $url = UploadTaskImage::run($task, $request->file('image'));

        return response()->json(['url' => $url]);
    }
}
