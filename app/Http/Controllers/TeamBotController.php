<?php

namespace App\Http\Controllers;

use App\Actions\Teams\CreateBotUser;
use App\Models\Team;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class TeamBotController extends Controller
{
    public function index(Team $team): Response
    {
        $this->authorize('update', $team);

        $bots = $team->bots()
            ->with(['tokens' => fn ($q) => $q->orderBy('created_at', 'desc')])
            ->orderBy('name')
            ->get();

        return Inertia::render('Teams/Settings/ApiTokens', [
            'team' => $team,
            'bots' => $bots,
        ]);
    }

    public function storeBot(Request $request, Team $team)
    {
        $this->authorize('update', $team);

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
        ]);

        CreateBotUser::run($team, $validated);

        return back()->with('success', 'Bot user created.');
    }

    public function createToken(Request $request, Team $team, User $user)
    {
        $this->authorize('update', $team);
        abort_unless($user->is_bot && $user->created_by_team_id === $team->id, 403);

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'abilities' => ['sometimes', 'array'],
            'abilities.*' => [Rule::in(['read', 'write'])],
        ]);

        $abilities = $validated['abilities'] ?? ['read'];
        $token = $user->createToken($validated['name'], $abilities);

        return back()->with('success', 'Token created: '.$token->plainTextToken);
    }

    public function revokeToken(Request $request, Team $team, User $user, int $tokenId)
    {
        $this->authorize('update', $team);
        abort_unless($user->is_bot && $user->created_by_team_id === $team->id, 403);

        $user->tokens()->where('id', $tokenId)->delete();

        return back()->with('success', 'Token revoked.');
    }

    public function destroyBot(Team $team, User $user)
    {
        $this->authorize('update', $team);
        abort_unless($user->is_bot && $user->created_by_team_id === $team->id, 403);

        $user->tokens()->delete();
        $team->members()->detach($user->id);
        $user->update(['deactivated_at' => now()]);

        return back()->with('success', 'Bot user removed.');
    }
}
