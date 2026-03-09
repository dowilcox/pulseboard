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

        $data = $request->validated();

        // Apply default task template if set and no template was explicitly used
        if ($board->default_task_template_id && $board->defaultTaskTemplate) {
            $template = $board->defaultTaskTemplate;
            $data = array_merge([
                'description' => $template->description_template,
                'priority' => $template->priority,
                'effort_estimate' => $template->effort_estimate,
                'label_ids' => $template->label_ids ?? [],
            ], $data);
        }

        CreateTask::run($board, $column, $data, $request->user());

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
        $members = $team->members()->whereNull('deactivated_at')->get();
        $labels = Label::where('team_id', $team->id)->get();

        $gitlabProjects = $team->gitlabProjects()
            ->with('connection')
            ->get();

        // Get all tasks in this board for dependency autocomplete
        $boardTasks = Task::where('board_id', $board->id)
            ->select('id', 'task_number', 'title', 'column_id')
            ->get();

        // Get all boards in this team for cross-board move
        $teamBoards = $team->boards()
            ->active()
            ->with('columns')
            ->orderBy('name')
            ->get(['id', 'name', 'team_id']);

        return Inertia::render('Tasks/Show', [
            'team' => $team,
            'board' => $board,
            'task' => $task,
            'members' => $members,
            'labels' => $labels,
            'gitlabProjects' => $gitlabProjects,
            'teamBoards' => $teamBoards,
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

        $targetBoardId = $request->validated('board_id');
        $targetBoard = null;

        if ($targetBoardId && $targetBoardId !== $board->id) {
            // Cross-board move: validate target board belongs to same team
            $targetBoard = $team->boards()->active()->findOrFail($targetBoardId);
            $this->authorize('update', $targetBoard);
            $column = $targetBoard->columns()->findOrFail($request->validated('column_id'));
        } else {
            $column = $board->columns()->findOrFail($request->validated('column_id'));
        }

        MoveTask::run($task, $column, $request->validated('sort_order'), $targetBoard);

        if ($targetBoard) {
            return Redirect::route('tasks.show', [$team->id, $targetBoard->id, $task->id]);
        }

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

        $validLabelIds = Label::where('team_id', $team->id)->whereIn('id', $validated['label_ids'])->pluck('id')->toArray();

        SyncTaskLabels::run($task, $validLabelIds);

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
