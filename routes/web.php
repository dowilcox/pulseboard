<?php

use App\Http\Controllers\Auth\SamlController;
use App\Http\Controllers\AvatarController;
use App\Http\Controllers\DashboardController;
use App\Models\AppSetting;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

Route::get('/', function () {
    if (Auth::check()) {
        return redirect()->route('dashboard');
    }

    return Inertia::render('Welcome', [
        'canLogin' => Route::has('login'),
        'canRegister' => Route::has('register') && ! AppSetting::isLocalAuthDisabled(),
    ]);
});

Route::get('/avatars/{user}', [AvatarController::class, 'show'])
    ->middleware('throttle:60,1')
    ->name('avatars.show');

Route::get('/auth/saml/login', [SamlController::class, 'redirect'])
    ->middleware('throttle:10,1')
    ->name('saml.login');
Route::post('/auth/saml/acs', [SamlController::class, 'acs'])
    ->middleware('throttle:10,1')
    ->name('saml.acs');
Route::get('/auth/saml/metadata', [SamlController::class, 'metadata'])
    ->middleware('throttle:10,1')
    ->name('saml.metadata');

Route::get('/dashboard', [DashboardController::class, 'index'])
    ->middleware(['auth', 'verified'])
    ->name('dashboard');

// Auth routes must be registered before the {team} catch-all.
require __DIR__.'/auth.php';

Route::middleware('auth')->group(function () {
    require __DIR__.'/web/profile.php';
    require __DIR__.'/web/notifications.php';
    require __DIR__.'/web/admin.php';

    // Static board and team routes must be registered before the slug-based
    // /{team}/... and /{team}/{board}/... includes below.
    require __DIR__.'/web/templates.php';
    require __DIR__.'/web/teams.php';
});
