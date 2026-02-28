<?php

namespace App\Http\Controllers;

use App\Actions\Boards\ArchiveBoard;
use App\Actions\Boards\CreateBoard;
use App\Actions\Boards\UpdateBoard;
use App\Http\Requests\StoreBoardRequest;
use App\Http\Requests\UpdateBoardRequest;
use App\Models\Board;
use App\Models\Team;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Redirect;
use Inertia\Inertia;
use Inertia\Response;

class BoardController extends Controller
{
    public function show(Team $team, Board $board): Response
    {
        $this->authorize('view', $board);

        $board->load(['columns.tasks' => function ($query) {
            $query->with(['assignees', 'labels', 'gitlabLinks'])
                ->withCount(['comments', 'subtasks'])
                ->orderBy('sort_order');
        }]);

        $members = $team->members()->get();

        $gitlabProjects = $team->gitlabProjects()
            ->with('connection')
            ->get();

        return Inertia::render('Boards/Show', [
            'team' => $team,
            'board' => $board,
            'columns' => $board->columns,
            'members' => $members,
            'gitlabProjects' => $gitlabProjects,
        ]);
    }

    /**
     * Store a newly created board for the team.
     */
    public function store(StoreBoardRequest $request, Team $team): RedirectResponse
    {
        $this->authorize('create', [Board::class, $team]);

        $board = CreateBoard::run($team, $request->validated());

        return Redirect::route('teams.boards.show', [$team, $board]);
    }

    /**
     * Update the specified board.
     */
    public function update(UpdateBoardRequest $request, Team $team, Board $board): RedirectResponse
    {
        $this->authorize('update', $board);

        UpdateBoard::run($board, $request->validated());

        return Redirect::route('teams.boards.show', [$team, $board]);
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

        $board->load('columns');

        $members = $team->members()->get();

        return Inertia::render('Boards/Settings', [
            'team' => $team,
            'board' => $board,
            'columns' => $board->columns,
            'members' => $members,
        ]);
    }
}
