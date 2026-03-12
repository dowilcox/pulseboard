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
                // Auto-link: the IdP has verified the email, so trust it
                $existingUser->update([
                    'auth_provider' => 'saml2',
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
