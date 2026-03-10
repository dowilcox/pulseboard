<?php

namespace App\Http\Middleware;

use Illuminate\Http\Request;
use Inertia\Middleware;

class HandleInertiaRequests extends Middleware
{
    /**
     * The root template that is loaded on the first page visit.
     *
     * @var string
     */
    protected $rootView = 'app';

    /**
     * Determine the current asset version.
     */
    public function version(Request $request): ?string
    {
        return parent::version($request);
    }

    /**
     * Define the props that are shared by default.
     *
     * @return array<string, mixed>
     */
    public function share(Request $request): array
    {
        return [
            ...parent::share($request),
            'auth' => [
                'user' => $request->user(),
            ],
            'teams' => fn () => $request->user()
                ? $request
                    ->user()
                    ->teams()
                    ->with([
                        'boards' => fn ($q) => $q
                            ->select('id', 'team_id', 'name', 'sort_order')
                            ->orderBy('sort_order'),
                    ])
                    ->withPivot('role')
                    ->get()
                : [],
            'unreadNotificationsCount' => fn () => $request->user()
                ? $request->user()->unreadNotifications()->count()
                : 0,
            'flash' => [
                'success' => fn () => $request->session()->get('success'),
                'error' => fn () => $request->session()->get('error'),
                'token' => fn () => $request->session()->get('token'),
            ],
            'reverb' => [
                'key' => config('broadcasting.connections.reverb.key'),
                'host' => config(
                    'broadcasting.connections.reverb.options.host',
                ),
                'port' => config(
                    'broadcasting.connections.reverb.options.port',
                ),
                'scheme' => config(
                    'broadcasting.connections.reverb.options.scheme',
                ),
            ],
        ];
    }
}
