<?php

namespace App\Mcp\Tools;

use App\Mcp\Support\Presenter;
use App\Models\Board;
use App\Models\User;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\Server\Attributes\Description;
use Laravel\Mcp\Server\Attributes\Name;
use Laravel\Mcp\Server\Tools\Annotations\IsReadOnly;

#[Name('list_boards')]
#[Description('List boards. Pass `team` to list one team\'s boards; omit it to list boards across all your teams. Archived boards are excluded unless include_archived is true. Includes open/total task counts.')]
#[IsReadOnly]
class ListBoards extends PulseBoardTool
{
    public function schema(JsonSchema $schema): array
    {
        return [
            'team' => $schema->string()->description('Team slug or UUID. Omit to list boards from all your teams.'),
            'include_archived' => $schema->boolean()->description('Include archived boards. Default false.'),
        ];
    }

    protected function run(Request $request, User $user): Response
    {
        $request->validate([
            'team' => ['nullable', 'string', 'max:255'],
            'include_archived' => ['nullable', 'boolean'],
        ]);

        $query = Board::query()
            ->with('team:id,name,slug')
            ->withCount([
                'tasks',
                'tasks as open_tasks_count' => fn ($q) => $q->whereNull('completed_at'),
            ])
            ->when(! $request->boolean('include_archived'), fn ($q) => $q->active());

        if (filled($request->get('team'))) {
            $query->where('team_id', $this->resolveTeam($user, $request->get('team'))->id);
        } else {
            $query->whereIn('team_id', $this->memberTeamIds($user));
        }

        $boards = $query->orderBy('team_id')->orderBy('sort_order')->orderBy('name')->limit(500)->get();

        return $this->json([
            'boards' => $boards->map(fn (Board $board) => [
                ...Presenter::board($board),
                'open_tasks' => (int) $board->open_tasks_count,
                'total_tasks' => (int) $board->tasks_count,
            ])->values()->all(),
        ]);
    }
}
