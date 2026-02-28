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

class SamlController extends Controller
{
    public function __construct(
        private SamlService $samlService,
    ) {}

    public function redirect(): RedirectResponse
    {
        $config = SsoConfiguration::where('is_active', true)->first();

        if (! $config) {
            return redirect()->route('login')->with('status', 'SSO is not configured.');
        }

        $url = $this->samlService->initiateLogin($config);

        return redirect($url);
    }

    public function acs(Request $request): RedirectResponse
    {
        $config = SsoConfiguration::where('is_active', true)->first();

        if (! $config) {
            return redirect()->route('login')->with('status', 'SSO is not configured.');
        }

        try {
            $samlUser = $this->samlService->processResponse($config);
        } catch (\RuntimeException $e) {
            return redirect()->route('login')->with('status', 'SSO authentication failed: '.$e->getMessage());
        }

        $user = User::where('auth_provider', 'saml2')
            ->where('auth_provider_id', $samlUser['name_id'])
            ->first();

        if (! $user) {
            // Try to link by email
            $user = User::where('email', $samlUser['email'])->first();

            if ($user) {
                // Auto-link existing account
                $user->update([
                    'auth_provider' => 'saml2',
                    'auth_provider_id' => $samlUser['name_id'],
                ]);
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
            return redirect()->route('login')->with('status', 'Your account has been deactivated.');
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
