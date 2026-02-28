<?php

namespace App\Http\Middleware;

use App\Models\Team;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureTeamMember
{
    /**
     * Ensure the authenticated user is a member of the team in the route.
     */
    public function handle(Request $request, Closure $next): Response
    {
        $team = $request->route('team');

        if (! $team instanceof Team) {
            abort(404);
        }

        $user = $request->user();

        if (! $user || ! $team->hasUser($user)) {
            abort(403, 'You are not a member of this team.');
        }

        return $next($request);
    }
}
