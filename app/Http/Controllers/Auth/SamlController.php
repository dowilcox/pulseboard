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
        $config = SsoConfiguration::saml()->active()->first();

        if (! $config) {
            return redirect()->route('login')->with('error', 'SSO is not configured.');
        }

        $url = $this->samlService->initiateLogin($config);

        return redirect($url);
    }

    public function acs(Request $request): RedirectResponse
    {
        $config = SsoConfiguration::saml()->active()->first();

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

        $samlName = trim($samlUser['name']) ?: $samlUser['email'];

        if (! $user) {
            $user = User::firstOrNew(['email' => $samlUser['email']]);

            if (! $user->exists) {
                $user->email_verified_at = now();
            }
        }

        // Refuse before saving so a deactivated or bot account is never
        // modified or converted to SAML by an assertion.
        if ($user->deactivated_at) {
            return redirect()->route('login')->with('error', 'Your account has been deactivated.');
        }

        if ($user->is_bot) {
            Log::warning('SAML login refused: identity matches a bot account', [
                'config_id' => $config->id,
                'user_id' => $user->id,
            ]);

            return redirect()->route('login')->with('error', 'This account cannot sign in with SSO.');
        }

        $emailTaken = User::where('email', $samlUser['email'])
            ->when($user->exists, fn ($query) => $query->whereKeyNot($user->id))
            ->exists();

        $user->forceFill([
            'name' => $samlName,
            'auth_provider' => 'saml2',
            'auth_provider_id' => $samlUser['name_id'],
        ]);

        // Keep the current email if the asserted one belongs to another account.
        if (! $emailTaken) {
            $user->email = $samlUser['email'];
        }

        $user->save();

        Auth::login($user, true);
        $request->session()->regenerate();

        return redirect()->intended(route('dashboard'));
    }

    public function metadata(): Response
    {
        $config = SsoConfiguration::saml()->active()->first();

        if (! $config) {
            abort(404, 'SSO is not configured.');
        }

        $metadata = $this->samlService->getMetadata($config);

        return response($metadata, 200, [
            'Content-Type' => 'application/xml',
        ]);
    }
}
