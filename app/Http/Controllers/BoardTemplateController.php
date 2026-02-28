<?php

namespace App\Http\Controllers;

use App\Models\Board;
use App\Models\BoardTemplate;
use App\Models\Column;
use App\Models\Team;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class BoardTemplateController extends Controller
{
    public function index(): JsonResponse
    {
        $templates = BoardTemplate::with('creator:id,name')
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

    public function createFromBoard(Team $team, Board $board): JsonResponse
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

        $template = BoardTemplate::create([
            'name' => $board->name.' Template',
            'description' => 'Created from board "'.$board->name.'"',
            'created_by' => auth()->id(),
            'template_data' => $templateData,
        ]);

        return response()->json($template->load('creator:id,name'), 201);
    }

    public function createBoardFromTemplate(Request $request, Team $team, BoardTemplate $boardTemplate): JsonResponse
    {
        $this->authorize('update', $team);

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
        ]);

        $board = $team->boards()->create([
            'name' => $validated['name'],
            'description' => $validated['description'] ?? null,
            'sort_order' => $team->boards()->count(),
        ]);

        $templateColumns = $boardTemplate->template_data['columns'] ?? [];
        foreach ($templateColumns as $i => $colData) {
            $board->columns()->create([
                'name' => $colData['name'],
                'color' => $colData['color'],
                'wip_limit' => $colData['wip_limit'] ?? null,
                'is_done_column' => $colData['is_done_column'] ?? false,
                'sort_order' => $i,
            ]);
        }

        return response()->json($board->load('columns'), 201);
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
