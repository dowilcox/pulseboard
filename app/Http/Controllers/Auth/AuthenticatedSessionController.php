<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\LoginRequest;
use App\Models\AppSetting;
use App\Models\SsoConfiguration;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;
use Inertia\Response;

class AuthenticatedSessionController extends Controller
{
    /**
     * Display the login view.
     */
    public function create(): Response|\Symfony\Component\HttpFoundation\Response
    {
        $ssoEnabled = SsoConfiguration::where('is_active', true)->exists();

        if (AppSetting::isLocalAuthDisabled() && $ssoEnabled) {
            return Inertia::location(route('saml.login'));
        }

        return Inertia::render('Auth/Login', [
            'canResetPassword' => Route::has('password.request'),
            'status' => session('status'),
            'error' => session('error'),
            'ssoEnabled' => $ssoEnabled,
            'localAuthEnabled' => ! AppSetting::isLocalAuthDisabled(),
        ]);
    }

    /**
     * Handle an incoming authentication request.
     */
    public function store(LoginRequest $request): RedirectResponse
    {
        if (AppSetting::isLocalAuthDisabled()) {
            return redirect()->route('login')->with('error', 'Local authentication is disabled. Please use SSO.');
        }

        $request->authenticate();

        $request->session()->regenerate();

        return redirect()->intended(route('dashboard', absolute: false));
    }

    /**
     * Destroy an authenticated session.
     */
    public function destroy(Request $request): RedirectResponse
    {
        Auth::guard('web')->logout();

        $request->session()->invalidate();

        $request->session()->regenerateToken();

        return redirect('/');
    }
}
