<?php

namespace App\Http\Middleware;

use App\Models\GitlabConnection;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class VerifyGitlabWebhook
{
    public function handle(Request $request, Closure $next): Response
    {
        $connection = $request->route('connection');

        if (! $connection instanceof GitlabConnection) {
            abort(404);
        }

        $token = $request->header('X-Gitlab-Token');

        if (! $token || $token !== $connection->webhook_secret) {
            abort(403, 'Invalid webhook token.');
        }

        return $next($request);
    }
}
