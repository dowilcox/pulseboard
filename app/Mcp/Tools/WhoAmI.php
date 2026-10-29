<?php

namespace App\Mcp\Tools;

use App\Mcp\Support\Presenter;
use App\Models\User;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\Server\Attributes\Description;
use Laravel\Mcp\Server\Attributes\Name;
use Laravel\Mcp\Server\Tools\Annotations\IsReadOnly;

#[Name('whoami')]
#[Description('Show the PulseBoard user this connection acts as, the API token\'s abilities (whether write tools are allowed), and the teams the user belongs to with their role. Call this first to orient yourself.')]
#[IsReadOnly]
class WhoAmI extends PulseBoardTool
{
    protected function run(Request $request, User $user): Response
    {
        $token = $user->currentAccessToken();
        $abilities = is_array($token?->abilities) ? array_values($token->abilities) : [];
        $tokenName = is_string($token?->name) ? $token->name : null;

        return $this->json([
            'user' => Presenter::compact([
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'is_bot' => $user->is_bot ? true : null,
            ]),
            'token' => Presenter::compact([
                'name' => $tokenName,
                'abilities' => $abilities,
                'can_write' => $user->tokenCan('write'),
            ]),
            'teams' => $user->teams()->orderBy('name')->get()
                ->map(fn ($team) => Presenter::team($team, $team->pivot->role))
                ->values()->all(),
            'app_url' => url('/'),
        ]);
    }
}
