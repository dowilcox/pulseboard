<?php

namespace App\Http\Controllers\Api\V1;

use App\Actions\Tasks\AssignTask;
use App\Actions\Tasks\CreateTask;
use App\Actions\Tasks\DeleteTask;
use App\Actions\Tasks\MoveTask;
use App\Actions\Tasks\SyncTaskLabels;
use App\Actions\Tasks\ToggleTaskCompletion;
use App\Actions\Tasks\ToggleTaskWatch;
use App\Actions\Tasks\UpdateTask;
use App\Http\Controllers\Controller;
use App\Http\Requests\MoveTaskRequest;
use App\Http\Requests\StoreTaskRequest;
use App\Http\Requests\UpdateTaskRequest;
use App\Models\Board;
use App\Models\Column;
use App\Models\Task;
use App\Models\Team;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class TaskController extends Controller
{
    public function index(Request $request, Team $team, Board $board): JsonResponse
    {
        $this->authorize('view', $board);

        $validated = $request->validate([
            'column_id' => ['sometimes', 'uuid', 'exists:columns,id'],
            'per_page' => ['sometimes', 'integer', 'min:1', 'max:100'],
            'sort' => ['sometimes', 'string', 'in:sort_order,task_number,title,priority,due_date,created_at'],
            'direction' => ['sometimes', 'string', 'in:asc,desc'],
            'assignee_id' => ['sometimes', 'uuid'],
            'label_id' => ['sometimes', 'uuid'],
            'priority' => ['sometimes', 'string', 'in:urgent,high,medium,low,none'],
            'status' => ['sometimes', 'string', 'in:open,completed,all'],
            'q' => ['sometimes', 'string', 'max:255'],
        ]);

        $perPage = $validated['per_page'] ?? 50;
        $sort = $validated['sort'] ?? 'sort_order';
        $direction = $validated['direction'] ?? 'asc';

        $query = Task::where('board_id', $board->id)
            ->with([
                'assignees',
                'labels',
                'column:id,name,board_id',
                'gitlabProject',
                'gitlabRefs',
                'blockedBy:id',
            ])
            ->withCount([
                'comments',
                'subtasks',
                'subtasks as completed_subtasks_count' => function ($q) {
                    $q->whereNotNull('completed_at');
                },
            ]);

        if (isset($validated['column_id'])) {
            $query->where('column_id', $validated['column_id']);
        }

        if (isset($validated['assignee_id'])) {
            $query->whereHas('assignees', fn ($q) => $q->where('users.id', $validated['assignee_id']));
        }

        if (isset($validated['label_id'])) {
            $query->whereHas('labels', fn ($q) => $q->where('labels.id', $validated['label_id']));
        }

        if (isset($validated['priority'])) {
            $query->where('priority', $validated['priority']);
        }

        if (isset($validated['q'])) {
            $q = $validated['q'];
            $query->where(function ($sub) use ($q) {
                $sub->where('title', 'like', "%{$q}%");

                if (ctype_digit($q) && (int) $q > 0) {
                    $sub->orWhere('task_number', (int) $q);
                }
            });
        }

        $status = $validated['status'] ?? 'all';
        if ($status === 'open') {
            $query->whereNull('completed_at');
        } elseif ($status === 'completed') {
            $query->whereNotNull('completed_at');
        }

        if ($sort === 'priority') {
            $query->orderByRaw(
                "CASE priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 WHEN 'low' THEN 4 ELSE 5 END "
                .($direction === 'desc' ? 'DESC' : 'ASC')
            );
        } else {
            $query->orderBy($sort, $direction);
        }

        return response()->json($query->paginate($perPage));
    }

    public function show(Team $team, Board $board, Task $task): JsonResponse
    {
        $this->authorize('view', $board);

        $task->load(['assignees', 'labels', 'comments.user', 'column:id,name,board_id', 'subtasks', 'activities.user', 'blockedBy', 'dependencies']);

        return response()->json(['data' => $task]);
    }

    public function store(StoreTaskRequest $request, Team $team, Board $board, Column $column): JsonResponse
    {
        $this->authorize('create', [Task::class, $board]);

        $task = CreateTask::run($board, $column, $request->validated(), $request->user());

        return response()->json(['data' => $task], 201);
    }

    public function update(UpdateTaskRequest $request, Team $team, Board $board, Task $task): JsonResponse
    {
        $this->authorize('update', $task);

        $task = UpdateTask::run($task, $request->validated());

        return response()->json(['data' => $task]);
    }

    public function move(MoveTaskRequest $request, Team $team, Board $board, Task $task): JsonResponse
    {
        $this->authorize('update', $task);

        [$targetBoard, $column] = app(MoveTask::class)->resolveTarget(
            $team,
            $board,
            $request->validated('board_id'),
            $request->validated('column_id'),
        );

        if ($targetBoard) {
            $this->authorize('update', $targetBoard);
        }

        $task = MoveTask::run(
            $task,
            $column,
            $request->validated('sort_order'),
            $targetBoard,
        );

        return response()->json(['data' => $task]);
    }

    public function destroy(Team $team, Board $board, Task $task): JsonResponse
    {
        $this->authorize('delete', $task);

        DeleteTask::run($task);

        return response()->json(null, 204);
    }

    public function complete(Request $request, Team $team, Board $board, Task $task): JsonResponse
    {
        $this->authorize('update', $task);

        $request->validate([
            'completed' => ['sometimes', 'boolean'],
        ]);

        // When an explicit target state is provided, the endpoint is
        // idempotent: a task already in that state is returned unchanged.
        if ($request->has('completed')
            && $request->boolean('completed') === ($task->completed_at !== null)) {
            return response()->json(['data' => $task]);
        }

        $task = ToggleTaskCompletion::run($task, $request->user());

        return response()->json(['data' => $task]);
    }

    public function watch(Request $request, Team $team, Board $board, Task $task): JsonResponse
    {
        $this->authorize('view', $task);

        $request->validate([
            'watching' => ['sometimes', 'boolean'],
        ]);

        $isWatching = $task->watchers()->where('users.id', $request->user()->id)->exists();

        // When an explicit target state is provided, the endpoint is
        // idempotent: no toggle happens if the state already matches.
        if ($request->has('watching') && $request->boolean('watching') === $isWatching) {
            return response()->json(['data' => ['watching' => $isWatching]]);
        }

        $watching = ToggleTaskWatch::run($task, $request->user());

        return response()->json(['data' => ['watching' => $watching]]);
    }

    public function assignees(Request $request, Team $team, Board $board, Task $task): JsonResponse
    {
        $this->authorize('assign', $task);

        $validated = $request->validate([
            'user_ids' => ['required', 'array'],
            'user_ids.*' => [
                'uuid',
                Rule::exists('team_members', 'user_id')->where(
                    fn ($query) => $query->where('team_id', $team->id),
                ),
            ],
        ]);

        $task = AssignTask::run($task, $validated['user_ids'], $request->user());

        return response()->json(['data' => $task]);
    }

    public function labels(Request $request, Team $team, Board $board, Task $task): JsonResponse
    {
        $this->authorize('update', $task);

        $validated = $request->validate([
            'label_ids' => ['required', 'array'],
            'label_ids.*' => [
                'uuid',
                Rule::exists('labels', 'id')->where(
                    fn ($query) => $query->where('team_id', $team->id),
                ),
            ],
        ]);

        $task = SyncTaskLabels::run($task, $validated['label_ids']);

        return response()->json(['data' => $task]);
    }
}
