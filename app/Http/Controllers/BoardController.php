<?php

namespace App\Http\Controllers;

use App\Actions\Boards\ArchiveBoard;
use App\Actions\Boards\CreateBoard;
use App\Actions\Boards\DeleteBoard;
use App\Actions\Boards\UpdateBoard;
use App\Http\Requests\ConfirmDeleteRequest;
use App\Http\Requests\StoreBoardRequest;
use App\Http\Requests\UpdateBoardRequest;
use App\Models\Board;
use App\Models\Label;
use App\Models\Task;
use App\Models\TaskTemplate;
use App\Models\Team;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Redirect;
use Inertia\Inertia;
use Inertia\Response;
use Spatie\MediaLibrary\MediaCollections\Exceptions\FileCannotBeAdded;
use Spatie\MediaLibrary\MediaCollections\Exceptions\FileIsTooBig;

class BoardController extends Controller
{
    /**
     * The maximum number of tasks loaded per column in the initial page load.
     * Additional tasks are fetched on demand via the API.
     */
    private const INITIAL_TASKS_PER_COLUMN = 20;

    public function show(Team $team, Board $board): Response
    {
        $this->authorize('view', $board);

        $sidebarBoards = $this->sidebarBoards($team);

        $board->load([
            'columns' => fn ($query) => $query->withCount('tasks'),
        ]);

        $initialTasks = $this->initialTasksByColumn($board);

        $board->columns->each(function ($column) use ($initialTasks) {
            $column->setRelation(
                'tasks',
                $initialTasks->get($column->id, collect()),
            );
        });

        $members = $team->members()->whereNull('deactivated_at')->get();

        $gitlabProjects = $team->gitlabProjects()->with('connection')->get();

        $figmaConnections = $team
            ->figmaConnections()
            ->where('is_active', true)
            ->get();

        $taskTemplates = TaskTemplate::where('team_id', $team->id)
            ->orderBy('name')
            ->get(['id', 'name']);

        $labels = $team->labels()->orderBy('name')->get();

        return Inertia::render('Boards/Show', [
            'team' => $team,
            'board' => $board,
            'sidebarBoards' => $sidebarBoards,
            'columns' => $board->columns,
            'members' => $members,
            'gitlabProjects' => $gitlabProjects,
            'figmaConnections' => $figmaConnections,
            'taskTemplates' => $taskTemplates,
            'labels' => $labels,
            'initialTasksPerColumn' => self::INITIAL_TASKS_PER_COLUMN,
        ]);
    }

    /**
     * Store a newly created board for the team.
     */
    public function store(
        StoreBoardRequest $request,
        Team $team,
    ): RedirectResponse {
        $this->authorize('create', [Board::class, $team]);

        $board = CreateBoard::run($team, $request->validated());

        return Redirect::route('teams.boards.show', [$team, $board]);
    }

    /**
     * Update the specified board.
     */
    public function update(
        UpdateBoardRequest $request,
        Team $team,
        Board $board,
    ): RedirectResponse {
        $this->authorize('update', $board);

        UpdateBoard::run($board, $request->validated());

        return Redirect::route('teams.boards.show', [$team, $board]);
    }

    /**
     * Delete the specified board permanently.
     */
    public function destroy(ConfirmDeleteRequest $request, Team $team, Board $board): RedirectResponse
    {
        $this->authorize('delete', $board);

        DeleteBoard::run($board);

        return Redirect::route('teams.show', $team);
    }

    /**
     * Archive the specified board.
     */
    public function archive(Team $team, Board $board): RedirectResponse
    {
        $this->authorize('delete', $board);

        ArchiveBoard::run($board);

        return Redirect::route('teams.show', $team);
    }

    /**
     * Display the board settings page.
     */
    public function settings(Team $team, Board $board): Response
    {
        $this->authorize('update', $board);

        $sidebarBoards = $this->sidebarBoards($team);
        $board->load('columns');

        $members = $team->members()->whereNull('deactivated_at')->get();
        $labels = Label::where('team_id', $team->id)->get();

        return Inertia::render('Boards/Settings', [
            'team' => $team,
            'board' => $board,
            'sidebarBoards' => $sidebarBoards,
            'columns' => $board->columns,
            'members' => $members,
            'labels' => $labels,
        ]);
    }

    private function sidebarBoards(Team $team): Collection
    {
        return $team->boards()
            ->active()
            ->select('id', 'team_id', 'name', 'slug', 'sort_order')
            ->with('media')
            ->orderBy('sort_order')
            ->get();
    }

    private function initialTasksByColumn(Board $board): Collection
    {
        $limitedTaskIds = DB::query()
            ->fromSub(function ($query) use ($board) {
                $query->from('tasks')
                    ->select([
                        'id',
                        'column_id',
                        DB::raw(
                            'ROW_NUMBER() OVER (PARTITION BY column_id ORDER BY sort_order) as row_num',
                        ),
                    ])
                    ->where('board_id', $board->id);
            }, 'ranked_tasks')
            ->where('row_num', '<=', self::INITIAL_TASKS_PER_COLUMN)
            ->pluck('id');

        if ($limitedTaskIds->isEmpty()) {
            return collect();
        }

        return Task::whereIn('id', $limitedTaskIds)
            ->with([
                'assignees',
                'labels',
                'gitlabProject',
                'gitlabRefs',
                'blockedBy:id',
            ])
            ->withCount([
                'comments',
                'subtasks',
                'subtasks as completed_subtasks_count' => fn ($query) => $query->whereNotNull('completed_at'),
            ])
            ->orderBy('column_id')
            ->orderBy('sort_order')
            ->get()
            ->groupBy('column_id');
    }

    public function uploadImage(Request $request, Team $team, Board $board): JsonResponse
    {
        $this->authorize('update', $board);

        $maxSize = config('uploads.max_size.avatar');
        $allowedTypes = implode(',', config('uploads.image_types'));

        $request->validate([
            'image' => ['required', 'image', "max:{$maxSize}", "mimes:{$allowedTypes}"],
        ]);

        try {
            $board->addMedia($request->file('image'))
                ->toMediaCollection('avatar');
        } catch (FileIsTooBig) {
            return response()->json(['message' => 'The image is too large. Maximum size is 2MB.'], 422);
        } catch (FileCannotBeAdded $e) {
            return response()->json(['message' => 'The image could not be uploaded: '.$e->getMessage()], 422);
        }

        return response()->json([
            'image_url' => $board->getFirstMediaUrl('avatar', 'avatar'),
        ]);
    }

    public function deleteImage(Team $team, Board $board): JsonResponse
    {
        $this->authorize('update', $board);

        $board->clearMediaCollection('avatar');

        return response()->json(['message' => 'Image removed']);
    }
}
