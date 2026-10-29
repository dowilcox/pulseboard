<?php

namespace App\Mcp\Tools;

use App\Mcp\Support\Presenter;
use App\Models\Column;
use App\Models\Label;
use App\Models\User;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\Server\Attributes\Description;
use Laravel\Mcp\Server\Attributes\Name;
use Laravel\Mcp\Server\Tools\Annotations\IsReadOnly;

#[Name('get_board')]
#[Description('Get a board\'s structure: columns in order (id, name, WIP limit, whether it is a "done" column, open/total task counts), the team\'s labels, and the team\'s active members (ids, names, emails, roles) for assigning and @mentioning. Call this before creating or moving tasks.')]
#[IsReadOnly]
class GetBoard extends PulseBoardTool
{
    public function schema(JsonSchema $schema): array
    {
        return [
            'board' => $schema->string()->description('Board UUID, slug, or "team-slug/board-slug".')->required(),
            'team' => $schema->string()->description('Team slug or UUID; only needed when a board slug exists in several of your teams.'),
        ];
    }

    protected function run(Request $request, User $user): Response
    {
        $request->validate([
            'board' => ['required', 'string', 'max:255'],
            'team' => ['nullable', 'string', 'max:255'],
        ]);

        $board = $this->resolveBoard($user, $request->get('board'), $request->get('team'));
        $team = $board->team;

        $columns = $board->columns()
            ->withCount([
                'tasks',
                'tasks as open_tasks_count' => fn ($q) => $q->whereNull('completed_at'),
            ])
            ->get();

        $members = $team->members()
            ->whereNull('deactivated_at')
            ->orderBy('name')
            ->get(['users.id', 'users.name', 'users.email', 'users.is_bot']);

        return $this->json([
            'board' => [
                ...Presenter::board($board, $team),
                'auto_move_to_done' => (bool) $board->setting('auto_move_to_done', false),
            ],
            'team' => Presenter::team($team),
            'columns' => $columns->map(fn (Column $column) => [
                ...Presenter::column($column),
                'open_tasks' => (int) $column->open_tasks_count,
                'total_tasks' => (int) $column->tasks_count,
            ])->values()->all(),
            'labels' => $team->labels()->orderBy('name')->get()
                ->map(fn (Label $label) => Presenter::label($label))->values()->all(),
            'members' => $members->map(fn (User $member) => Presenter::compact([
                'id' => $member->id,
                'name' => $member->name,
                'email' => $member->email,
                'role' => $member->pivot->role,
                'is_bot' => $member->is_bot ? true : null,
            ]))->values()->all(),
        ]);
    }
}
