<?php

use App\Http\Middleware\EnsureAdmin;
use App\Http\Middleware\EnsureNotDeactivated;
use App\Http\Middleware\EnsureTeamMember;
use App\Http\Middleware\HandleInertiaRequests;
use App\Http\Middleware\SecurityHeaders;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Middleware\AddLinkHeadersForPreloadedAssets;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Laravel\Sanctum\Http\Middleware\CheckAbilities;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;

return Application::configure(basePath: dirname(__DIR__))
    ->withEvents(discover: false)
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        channels: __DIR__.'/../routes/channels.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->validateCsrfTokens(except: [
            'auth/saml/acs',
        ]);

        $middleware->web(append: [
            SecurityHeaders::class,
            HandleInertiaRequests::class,
            AddLinkHeadersForPreloadedAssets::class,
            EnsureNotDeactivated::class,
        ]);

        $middleware->alias([
            'team.member' => EnsureTeamMember::class,
            'admin' => EnsureAdmin::class,
            'ensure.active' => EnsureNotDeactivated::class,
            'abilities' => CheckAbilities::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->respond(function (Response $response, Throwable $exception, Request $request) {
            $status = $exception instanceof HttpExceptionInterface
                ? $exception->getStatusCode()
                : $response->getStatusCode();

            if (! app()->environment('local') && in_array($status, [403, 404, 500, 503])) {
                return Inertia::render('Error', ['status' => $status])
                    ->toResponse($request)
                    ->setStatusCode($status);
            }

            return $response;
        });
    })->create();
