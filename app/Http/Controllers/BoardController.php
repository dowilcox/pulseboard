<?php

namespace App\Http\Controllers;

use App\Actions\Boards\ArchiveBoard;
use App\Actions\Boards\CreateBoard;
use App\Actions\Boards\DeleteBoard;
use App\Actions\Boards\UnarchiveBoard;
use App\Actions\Boards\UpdateBoard;
use App\Actions\Media\DeleteModelAvatar;
use App\Actions\Media\UploadModelAvatar;
use App\Http\Requests\ConfirmDeleteRequest;
use App\Http\Requests\StoreBoardRequest;
use App\Http\Requests\UpdateBoardRequest;
use App\Models\Board;
use App\Models\Label;
use App\Models\SavedFilter;
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

        // The viewer's saved filters ship with the page so a default filter
        // can be applied on the first render instead of after a fetch.
        $savedFilters = SavedFilter::where('board_id', $board->id)
            ->where('user_id', auth()->id())
            ->orderBy('name')
            ->get();

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
            'savedFilters' => $savedFilters,
            'can' => [
                'update' => auth()->user()->can('update', $board),
            ],
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

        return Redirect::route('teams.boards.show', [$team, $board])
            ->with('success', "Board “{$board->name}” created.");
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

        // Renaming changes the slug, so redirect to the refreshed board's
        // settings URL rather than back() to the old one.
        $board = UpdateBoard::run($board, $request->validated());

        return Redirect::route('teams.boards.settings', [$team, $board])
            ->with('success', 'Board details saved.');
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

        return Redirect::route('teams.show', $team)
            ->with('success', "Board “{$board->name}” archived. Restore it from Archived boards on this page.");
    }

    /**
     * Restore an archived board.
     */
    public function unarchive(Team $team, Board $board): RedirectResponse
    {
        $this->authorize('update', $board);

        UnarchiveBoard::run($board);

        return Redirect::back()
            ->with('success', "Board “{$board->name}” restored.");
    }

    /**
     * Display the board settings page.
     */
    public function settings(Team $team, Board $board): Response
    {
        $this->authorize('update', $board);

        $sidebarBoards = $this->sidebarBoards($team);
        // tasks_count lets the settings page ask where a removed column's tasks go.
        $board->load(['columns' => fn ($query) => $query->withCount('tasks')]);

        $members = $team->members()->whereNull('deactivated_at')->get();
        $labels = Label::where('team_id', $team->id)->get();
        $user = request()->user();

        return Inertia::render('Boards/Settings', [
            'team' => $team,
            'board' => $board,
            'sidebarBoards' => $sidebarBoards,
            'columns' => $board->columns,
            'members' => $members,
            'labels' => $labels,
            'can' => [
                'archive' => $user->can('delete', $board),
                'delete' => $user->can('delete', $board),
                'manageTaskTemplates' => $user->can('update', $team),
            ],
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

        return UploadModelAvatar::run($request, $board);
    }

    public function deleteImage(Team $team, Board $board): JsonResponse
    {
        $this->authorize('update', $board);

        return DeleteModelAvatar::run($board);
    }
}
