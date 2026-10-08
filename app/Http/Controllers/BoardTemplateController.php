<?php

namespace App\Http\Controllers;

use App\Actions\Boards\CreateBoardFromTemplate;
use App\Models\Board;
use App\Models\BoardTemplate;
use App\Models\Column;
use App\Models\Team;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Redirect;

class BoardTemplateController extends Controller
{
    public function index(): JsonResponse
    {
        $templates = BoardTemplate::with('creator:id,name')
            ->where('created_by', auth()->id())
            ->orderBy('name')
            ->get();

        return response()->json($templates);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'template_data' => ['required', 'array'],
            'template_data.columns' => ['required', 'array', 'min:1'],
            'template_data.columns.*.name' => ['required', 'string'],
            'template_data.columns.*.color' => ['required', 'string'],
            'template_data.columns.*.wip_limit' => ['nullable', 'integer'],
            'template_data.columns.*.is_done_column' => ['required', 'boolean'],
        ]);

        $template = BoardTemplate::create([
            'name' => $validated['name'],
            'description' => $validated['description'] ?? null,
            'created_by' => auth()->id(),
            'template_data' => $validated['template_data'],
        ]);

        return response()->json($template->load('creator:id,name'), 201);
    }

    public function createFromBoard(Team $team, Board $board): RedirectResponse
    {
        $this->authorize('view', $board);

        $columns = $board->columns()->orderBy('sort_order')->get();

        $templateData = [
            'columns' => $columns->map(fn (Column $col) => [
                'name' => $col->name,
                'color' => $col->color,
                'wip_limit' => $col->wip_limit,
                'is_done_column' => $col->is_done_column,
            ])->toArray(),
        ];

        $name = $board->name.' Template';

        // Idempotent: a repeat submit (double-click, retry) with unchanged
        // columns reuses the existing template instead of duplicating it.
        $alreadySaved = BoardTemplate::where('created_by', auth()->id())
            ->where('name', $name)
            ->get()
            ->contains(fn (BoardTemplate $template) => $template->template_data == $templateData);

        if ($alreadySaved) {
            return Redirect::back()->with('success', "This board is already saved as the \"{$name}\" template.");
        }

        BoardTemplate::create([
            'name' => $name,
            'description' => 'Created from board "'.$board->name.'"',
            'created_by' => auth()->id(),
            'template_data' => $templateData,
        ]);

        return Redirect::back()->with('success', "Saved as the \"{$name}\" board template.");
    }

    /**
     * Create a board from a template and open it. Called by the team page's
     * create-board dialog via Inertia (useForm), so it redirects rather than
     * returning JSON; validation errors flow back to the form inline.
     */
    public function createBoardFromTemplate(Request $request, Team $team, BoardTemplate $boardTemplate): RedirectResponse
    {
        $this->authorize('update', $team);

        abort_unless(
            $boardTemplate->created_by === auth()->id() || auth()->user()->is_admin,
            403,
        );

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:1000'],
        ]);

        $board = CreateBoardFromTemplate::run($team, $boardTemplate, $validated);

        return Redirect::route('teams.boards.show', [$team, $board])
            ->with('success', "Board “{$board->name}” created from the “{$boardTemplate->name}” template.");
    }

    public function destroy(BoardTemplate $boardTemplate): JsonResponse
    {
        abort_unless(
            $boardTemplate->created_by === auth()->id() || auth()->user()->is_admin,
            403,
        );

        $boardTemplate->delete();

        return response()->json(['message' => 'Template deleted']);
    }
}
