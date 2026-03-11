<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\SsoConfiguration;
use App\Models\User;
use App\Services\SamlService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;

class SamlController extends Controller
{
    public function __construct(
        private SamlService $samlService,
    ) {}

    public function redirect(): RedirectResponse
    {
        $config = SsoConfiguration::where('is_active', true)->first();

        if (! $config) {
            return redirect()->route('login')->with('error', 'SSO is not configured.');
        }

        $url = $this->samlService->initiateLogin($config);

        return redirect($url);
    }

    public function acs(Request $request): RedirectResponse
    {
        $config = SsoConfiguration::where('is_active', true)->first();

        if (! $config) {
            return redirect()->route('login')->with('error', 'SSO is not configured.');
        }

        try {
            $samlUser = $this->samlService->processResponse($config);
        } catch (\RuntimeException $e) {
            Log::error('SAML authentication failed', [
                'error' => $e->getMessage(),
                'config_id' => $config->id,
                'config_name' => $config->name,
            ]);

            return redirect()->route('login')->with('error', 'SSO authentication failed: '.$e->getMessage());
        }

        $user = User::where('auth_provider', 'saml2')
            ->where('auth_provider_id', $samlUser['name_id'])
            ->first();

        if (! $user) {
            // Try to link by email
            $existingUser = User::where('email', $samlUser['email'])->first();

            if ($existingUser) {
                // Only auto-link if the user has no other auth provider set
                if ($existingUser->auth_provider !== null && $existingUser->auth_provider !== 'saml2') {
                    return redirect()->route('login')->with(
                        'error',
                        'An account with this email already exists using a different login method. Please log in with your password and link your SAML account from profile settings.'
                    );
                }

                // Safe to auto-link: auth_provider is null (local) with no conflict, or already saml2
                if ($existingUser->auth_provider === null) {
                    // Local password account — do not overwrite, require manual linking
                    return redirect()->route('login')->with(
                        'error',
                        'An account with this email already exists. Please log in with your password and link your SAML account from profile settings.'
                    );
                }

                // auth_provider is already 'saml2' but different provider_id — link it
                $existingUser->update([
                    'auth_provider_id' => $samlUser['name_id'],
                ]);
                $user = $existingUser;
            } else {
                // JIT provisioning
                $user = User::create([
                    'name' => $samlUser['name'] ?: $samlUser['email'],
                    'email' => $samlUser['email'],
                    'auth_provider' => 'saml2',
                    'auth_provider_id' => $samlUser['name_id'],
                    'email_verified_at' => now(),
                ]);
            }
        }

        if ($user->deactivated_at) {
            return redirect()->route('login')->with('error', 'Your account has been deactivated.');
        }

        Auth::login($user, true);
        $request->session()->regenerate();

        return redirect()->intended(route('dashboard'));
    }

    public function metadata(): Response
    {
        $config = SsoConfiguration::where('is_active', true)->first();

        if (! $config) {
            abort(404, 'SSO is not configured.');
        }

        $metadata = $this->samlService->getMetadata($config);

        return response($metadata, 200, [
            'Content-Type' => 'application/xml',
        ]);
    }
}
