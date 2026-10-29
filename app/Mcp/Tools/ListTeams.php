<?php

namespace App\Mcp\Tools;

use App\Mcp\Support\Presenter;
use App\Models\User;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\Server\Attributes\Description;
use Laravel\Mcp\Server\Attributes\Name;
use Laravel\Mcp\Server\Tools\Annotations\IsReadOnly;

#[Name('list_teams')]
#[Description('List the teams you are a member of, with your role (owner/admin/member), member count and number of active boards. Team slugs/ids are used by list_boards and other tools.')]
#[IsReadOnly]
class ListTeams extends PulseBoardTool
{
    protected function run(Request $request, User $user): Response
    {
        $teams = $user->teams()
            ->withCount([
                'members',
                'boards as active_boards_count' => fn ($q) => $q->where('is_archived', false),
            ])
            ->orderBy('name')
            ->get();

        return $this->json([
            'teams' => $teams->map(fn ($team) => [
                ...Presenter::team($team, $team->pivot->role),
                'members' => (int) $team->members_count,
                'active_boards' => (int) $team->active_boards_count,
            ])->values()->all(),
        ]);
    }
}
