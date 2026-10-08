<?php

namespace App\Http\Controllers;

use App\Actions\Teams\CreateBotUser;
use App\Models\Team;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Redirect;
use Illuminate\Validation\Rule;

class TeamBotController extends Controller
{
    /**
     * Bots are managed on the "API & bots" tab of team settings; this URL is
     * kept so old links and bookmarks still land in the right place.
     */
    public function index(Request $request, Team $team): RedirectResponse
    {
        $this->authorize('update', $team);

        $request->session()->reflash();

        return Redirect::route('teams.settings', ['team' => $team, 'tab' => 'api']);
    }

    public function storeBot(Request $request, Team $team)
    {
        $this->authorize('update', $team);

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
        ]);

        CreateBotUser::run($team, $validated);

        return back()->with('success', "Bot “{$validated['name']}” created.");
    }

    public function createToken(Request $request, Team $team, User $user)
    {
        $this->authorize('update', $team);
        abort_unless($user->is_bot && $user->created_by_team_id === $team->id, 403);
        abort_if($user->deactivated_at, 403, 'Cannot create tokens for a deactivated bot.');

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'abilities' => ['sometimes', 'array'],
            'abilities.*' => [Rule::in(['read', 'write'])],
        ]);

        $abilities = $validated['abilities'] ?? ['read'];
        $token = $user->createToken($validated['name'], $abilities);

        return back()->with('success', 'Token created successfully. Copy it now — it won\'t be shown again.')
            ->with('token', $token->plainTextToken);
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

        return back()->with('success', "Bot “{$user->name}” removed.");
    }
}
