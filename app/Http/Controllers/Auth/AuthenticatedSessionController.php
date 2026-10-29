<?php

namespace App\Http\Controllers\Auth;

use App\Exceptions\OidcException;
use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\LoginRequest;
use App\Models\AppSetting;
use App\Models\SsoConfiguration;
use App\Services\OidcService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\Response as BaseResponse;

class AuthenticatedSessionController extends Controller
{
    /**
     * Display the login view.
     */
    public function create(): Response|BaseResponse
    {
        $ssoProviders = SsoConfiguration::active()
            ->orderBy('name')
            ->get()
            ->map(fn (SsoConfiguration $config) => [
                'id' => $config->id,
                'provider' => $config->provider,
                'label' => $config->displayLabel(),
                'url' => $config->loginUrl(),
            ])
            ->values();

        $localAuthDisabled = AppSetting::isLocalAuthDisabled();

        // With passwords off and a single provider there is nothing to choose.
        // An error flash means that provider just failed: show it instead of
        // bouncing straight back into the same failing flow.
        if ($localAuthDisabled && $ssoProviders->count() === 1 && ! session('error')) {
            return Inertia::location($ssoProviders->first()['url']);
        }

        return Inertia::render('Auth/Login', [
            'canResetPassword' => Route::has('password.request'),
            'status' => session('status'),
            'error' => session('error'),
            'ssoEnabled' => $ssoProviders->isNotEmpty(),
            'ssoProviders' => $ssoProviders,
            'localAuthEnabled' => ! $localAuthDisabled,
            'canRegister' => Route::has('register') && ! $localAuthDisabled,
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
     *
     * For OIDC logins with single logout enabled, the browser is then sent
     * to the IdP's end_session_endpoint (RP-initiated logout).
     */
    public function destroy(Request $request, OidcService $oidc): BaseResponse
    {
        $endSessionUrl = $this->oidcEndSessionUrl($request, $oidc);

        Auth::guard('web')->logout();

        $request->session()->invalidate();

        $request->session()->regenerateToken();

        if ($endSessionUrl !== null) {
            // Inertia::location turns an Inertia XHR into a full-page visit.
            return Inertia::location($endSessionUrl);
        }

        return redirect('/');
    }

    private function oidcEndSessionUrl(Request $request, OidcService $oidc): ?string
    {
        $logout = $request->session()->get(OidcController::LOGOUT_SESSION_KEY);

        if (! is_array($logout) || ! is_string($logout['id_token'] ?? null)) {
            return null;
        }

        $config = SsoConfiguration::oidc()->find($logout['config_id'] ?? null);

        if (! $config) {
            return null;
        }

        try {
            return $oidc->endSessionUrl($config, $logout['id_token']);
        } catch (OidcException $e) {
            // Never block the local logout on the IdP being unreachable.
            Log::warning('OIDC end-session URL unavailable; logging out locally only', [
                'config_id' => $config->id,
                'error' => $e->getMessage(),
            ]);

            return null;
        }
    }
}
