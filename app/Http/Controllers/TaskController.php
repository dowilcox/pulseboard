<?php

namespace App\Http\Controllers;

use App\Actions\Tasks\AssignTask;
use App\Actions\Tasks\CreateTask;
use App\Actions\Tasks\DeleteTask;
use App\Actions\Tasks\MoveTask;
use App\Actions\Tasks\SyncTaskLabels;
use App\Actions\Tasks\ToggleTaskCompletion;
use App\Actions\Tasks\ToggleTaskWatch;
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
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Redirect;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;
use Spatie\MediaLibrary\MediaCollections\Exceptions\FileCannotBeAdded;
use Spatie\MediaLibrary\MediaCollections\Exceptions\FileIsTooBig;

class TaskController extends Controller
{
    /**
     * Store a newly created task in the column.
     */
    public function store(
        StoreTaskRequest $request,
        Team $team,
        Board $board,
        Column $column,
    ): RedirectResponse {
        $this->authorize('create', [Task::class, $board]);

        // Board default task template (if any) is applied inside CreateTask
        // so web and API task creation behave identically.
        CreateTask::run($board, $column, $request->validated(), $request->user());

        return Redirect::back();
    }

    public function show(
        Request $request,
        Team $team,
        Board $board,
        Task $task,
    ): JsonResponse|Response {
        $this->authorize('view', $task);

        $isWatching = $task->watchers()->where('users.id', $request->user()->id)->exists();

        $task->load([
            'assignees',
            'labels',
            'creator',
            'column',
            'comments' => fn ($q) => $q->topLevel()->orderBy('created_at'),
            'comments.user',
            'comments.replies' => fn ($q) => $q->orderBy('created_at'),
            'comments.replies.user',
            'activities.user',
            'subtasks.assignees',
            'subtasks.labels',
            'gitlabProject.connection',
            'gitlabRefs',
            'figmaLinks.figmaConnection',
            'dependencies.board:id,team_id,name,slug',
            'blockedBy.board:id,team_id,name,slug',
            'parentTask',
        ]);
        $task->loadCount([
            'comments',
            'subtasks',
            'subtasks as completed_subtasks_count' => function ($query) {
                $query->whereNotNull('completed_at');
            },
        ]);
        $task->load('media');
        $task->append('attachments');

        // Dependency chips only need the related board's name and slug.
        $task->dependencies
            ->merge($task->blockedBy)
            ->each(fn (Task $related) => $related->board?->setAppends([]));

        if (request()->wantsJson()) {
            return response()->json($task);
        }

        $user = $request->user();
        $canUpdate = $user->can('update', $task);

        $board->load('columns');
        $members = $team->members()->whereNull('deactivated_at')->get();
        $labels = Label::where('team_id', $team->id)->get();

        $gitlabProjects = $team->gitlabProjects()->with('connection')->get();

        $figmaConnections = $team
            ->figmaConnections()
            ->where('is_active', true)
            ->get();

        // Deferred: dependency autocomplete candidates — every task on this
        // board plus open tasks on the team's other active boards (with the
        // board name for cross-board chips). Can be thousands of rows, so it
        // loads after first paint.
        $boardTasks = Inertia::defer(fn () => $this->dependencyCandidates($team, $board));

        // Deferred: all boards in this team for the layout sidebar.
        $teamBoards = Inertia::defer(fn () => $team
            ->boards()
            ->active()
            ->select('id', 'team_id', 'name', 'slug', 'sort_order')
            ->with('media')
            ->with('columns')
            ->orderBy('sort_order')
            ->get());

        $moveTargets = $this->moveTargets($user, $team, $board, $canUpdate);

        return Inertia::render('Tasks/Show', [
            'team' => $team,
            'board' => $board,
            'task' => $task,
            'members' => $members,
            'labels' => $labels,
            'gitlabProjects' => $gitlabProjects,
            'figmaConnections' => $figmaConnections,
            'teamBoards' => $teamBoards,
            'boardTasks' => $boardTasks,
            'isWatching' => $isWatching,
            'moveTargets' => $moveTargets,
            'can' => [
                'update' => $canUpdate,
                'delete' => $user->can('delete', $task),
                'move' => $moveTargets->isNotEmpty(),
                'saveAsTemplate' => $user->can('update', $team),
            ],
        ]);
    }

    /**
     * Other active boards in the team the user may move the task to
     * (BoardPolicy::update on the target), with their columns.
     *
     * @return Collection<int, array<string, mixed>>
     */
    private function moveTargets(User $user, Team $team, Board $board, bool $canUpdateTask): Collection
    {
        if (! $canUpdateTask) {
            return collect();
        }

        return $team->boards()
            ->active()
            ->whereKeyNot($board->id)
            ->orderBy('sort_order')
            ->with(['columns' => fn ($query) => $query->withCount('tasks')])
            ->get()
            ->each(fn (Board $target) => $target->setRelation('team', $team))
            ->filter(fn (Board $target) => $user->can('update', $target))
            ->map(fn (Board $target) => [
                'id' => $target->id,
                'name' => $target->name,
                'slug' => $target->slug,
                'columns' => $target->columns->map(fn (Column $column) => [
                    'id' => $column->id,
                    'name' => $column->name,
                    'color' => $column->color,
                    'is_done_column' => (bool) $column->is_done_column,
                    'wip_limit' => $column->wip_limit,
                    'tasks_count' => $column->tasks_count,
                ])->values(),
            ])
            ->values();
    }

    /**
     * Tasks the current task may depend on: everything on its own board, plus
     * open tasks on the team's other active boards.
     *
     * @return Collection<int, array<string, mixed>>
     */
    private function dependencyCandidates(Team $team, Board $board): Collection
    {
        $boards = $team->boards()
            ->active()
            ->get(['id', 'name', 'slug'])
            ->keyBy('id');

        return Task::query()
            ->whereIn('board_id', $boards->keys())
            ->where(fn ($query) => $query
                ->where('board_id', $board->id)
                ->orWhereNull('completed_at'))
            ->select('id', 'board_id', 'task_number', 'title', 'column_id')
            ->orderByRaw('CASE WHEN board_id = ? THEN 0 ELSE 1 END', [$board->id])
            ->orderBy('board_id')
            ->orderBy('task_number')
            ->get()
            ->map(function (Task $candidate) use ($boards) {
                $candidateBoard = $boards->get($candidate->board_id);

                return [
                    'id' => $candidate->id,
                    'slug' => $candidate->slug,
                    'task_number' => $candidate->task_number,
                    'title' => $candidate->title,
                    'column_id' => $candidate->column_id,
                    'board_id' => $candidate->board_id,
                    'board' => [
                        'id' => $candidateBoard->id,
                        'name' => $candidateBoard->name,
                        'slug' => $candidateBoard->slug,
                    ],
                ];
            })
            ->values();
    }

    /**
     * Update the specified task.
     */
    public function update(
        UpdateTaskRequest $request,
        Team $team,
        Board $board,
        Task $task,
    ): RedirectResponse {
        $this->authorize('update', $task);

        UpdateTask::run($task, $request->validated());

        return Redirect::back();
    }

    /**
     * Delete the specified task.
     */
    public function destroy(
        Team $team,
        Board $board,
        Task $task,
    ): RedirectResponse {
        $this->authorize('delete', $task);

        DeleteTask::run($task);

        return Redirect::route('teams.boards.show', [$team, $board]);
    }

    /**
     * Move a task to a different column or reorder within a column.
     */
    public function move(
        MoveTaskRequest $request,
        Team $team,
        Board $board,
        Task $task,
    ): RedirectResponse {
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

        $moved = MoveTask::run(
            $task,
            $column,
            $request->validated('sort_order'),
            $targetBoard,
        );

        if ($targetBoard) {
            // The task number (and so its URL) changes on a cross-board move.
            return Redirect::route('tasks.show', [$team, $targetBoard, $moved])
                ->with('success', "Moved to {$targetBoard->name} › {$column->name}.");
        }

        return Redirect::back();
    }

    /**
     * Update task assignees.
     */
    public function updateAssignees(
        Request $request,
        Team $team,
        Board $board,
        Task $task,
    ): RedirectResponse {
        $this->authorize('assign', $task);

        $validated = $request->validate([
            'user_ids' => ['present', 'array'],
            'user_ids.*' => [
                'uuid',
                Rule::exists('team_members', 'user_id')->where(
                    fn ($query) => $query->where('team_id', $team->id),
                ),
            ],
        ]);

        AssignTask::run($task, $validated['user_ids'], $request->user());

        return Redirect::back();
    }

    /**
     * Update task labels.
     */
    public function updateLabels(
        Request $request,
        Team $team,
        Board $board,
        Task $task,
    ): RedirectResponse {
        $this->authorize('update', $task);

        $validated = $request->validate([
            'label_ids' => ['present', 'array'],
            'label_ids.*' => [
                'uuid',
                Rule::exists('labels', 'id')->where(
                    fn ($query) => $query->where('team_id', $team->id),
                ),
            ],
        ]);

        $validLabelIds = Label::where('team_id', $team->id)
            ->whereIn('id', $validated['label_ids'])
            ->pluck('id')
            ->toArray();

        SyncTaskLabels::run($task, $validLabelIds);

        return Redirect::back();
    }

    /**
     * Toggle task completion status.
     */
    public function toggleComplete(
        Request $request,
        Team $team,
        Board $board,
        Task $task,
    ): RedirectResponse {
        $this->authorize('update', $task);

        ToggleTaskCompletion::run($task, $request->user());

        return Redirect::back();
    }

    /**
     * Toggle watching a task.
     */
    public function toggleWatch(
        Request $request,
        Team $team,
        Board $board,
        Task $task,
    ): RedirectResponse {
        $this->authorize('view', $task);

        ToggleTaskWatch::run($task, $request->user());

        return Redirect::back();
    }

    /**
     * Upload an image for the task (e.g. for rich text editor).
     */
    public function uploadImage(
        Request $request,
        Team $team,
        Board $board,
        Task $task,
    ): JsonResponse {
        $this->authorize('update', $task);

        $maxSize = config('uploads.max_size.editor_image');
        $allowedTypes = implode(',', config('uploads.image_types'));

        $request->validate([
            'image' => ['required', 'image', "max:{$maxSize}", "mimes:{$allowedTypes}"],
        ]);

        try {
            $url = UploadTaskImage::run($task, $request->file('image'));
        } catch (FileIsTooBig) {
            return response()->json(['message' => 'The image is too large. Maximum size is 5MB.'], 422);
        } catch (FileCannotBeAdded $e) {
            return response()->json(['message' => 'The image could not be uploaded: '.$e->getMessage()], 422);
        }

        return response()->json(['url' => $url]);
    }
}
