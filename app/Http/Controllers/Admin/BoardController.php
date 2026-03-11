<?php

namespace App\Http\Controllers\Admin;

use App\Actions\Boards\DeleteBoard;
use App\Http\Controllers\Controller;
use App\Http\Requests\ConfirmDeleteRequest;
use App\Models\Board;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Redirect;
use Inertia\Inertia;
use Inertia\Response;

class BoardController extends Controller
{
    public function index(): Response
    {
        $boards = Board::with('team:id,name')
            ->withCount('tasks')
            ->orderBy('name')
            ->get();

        return Inertia::render('Admin/Boards', [
            'adminBoards' => $boards,
        ]);
    }

    public function destroy(ConfirmDeleteRequest $request, Board $board): RedirectResponse
    {
        DeleteBoard::run($board);

        return Redirect::route('admin.boards.index')
            ->with('success', "Board \"{$board->name}\" has been deleted.");
    }
}
