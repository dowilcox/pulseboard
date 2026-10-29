<?php

namespace App\Http\Controllers\Auth;

use App\Actions\Sso\ResolveOidcUser;
use App\Exceptions\OidcException;
use App\Http\Controllers\Controller;
use App\Models\SsoConfiguration;
use App\Services\OidcService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;

class OidcController extends Controller
{
    /** Session key holding state / nonce / PKCE verifier for the in-flight login. */
    public const FLOW_SESSION_KEY = 'oidc_flow';

    /** Session key holding what RP-initiated logout needs (config id + ID token). */
    public const LOGOUT_SESSION_KEY = 'oidc_logout';

    /** How long a started login may take before the callback is refused. */
    private const FLOW_TTL_SECONDS = 600;

    public function __construct(
        private OidcService $oidc,
    ) {}

    public function redirect(Request $request, SsoConfiguration $ssoConfiguration): RedirectResponse
    {
        if (! $this->isUsable($ssoConfiguration)) {
            return $this->fail('SSO is not configured.');
        }

        try {
            $authorization = $this->oidc->buildAuthorizationRequest($ssoConfiguration);
        } catch (OidcException $e) {
            $this->logFailure('OIDC login could not be started', $ssoConfiguration, $e);

            return $this->fail('Single sign-on is temporarily unavailable. Please try again later.');
        }

        // One in-flight login per session; starting another replaces it.
        $request->session()->put(self::FLOW_SESSION_KEY, [
            'config_id' => $ssoConfiguration->id,
            'state' => $authorization['state'],
            'nonce' => $authorization['nonce'],
            'code_verifier' => $authorization['code_verifier'],
            'created_at' => time(),
        ]);

        return redirect()->away($authorization['url']);
    }

    /**
     * The IdP redirects here with ?code&state (a top-level GET, so CSRF
     * middleware doesn't apply). The state parameter is what binds this
     * response to the login this browser started.
     */
    public function callback(Request $request, SsoConfiguration $ssoConfiguration): RedirectResponse
    {
        // Pull: the flow is single-use whatever happens next.
        $flow = $request->session()->pull(self::FLOW_SESSION_KEY);

        if (! $this->isUsable($ssoConfiguration)) {
            return $this->fail('SSO is not configured.');
        }

        $state = $request->query('state');

        if (! is_array($flow)
            || ($flow['config_id'] ?? null) !== $ssoConfiguration->id
            || ! is_string($state)
            || ! is_string($flow['state'] ?? null)
            || ! hash_equals($flow['state'], $state)) {
            Log::warning('OIDC callback rejected: missing or mismatched state', [
                'config_id' => $ssoConfiguration->id,
                'has_flow' => is_array($flow),
            ]);

            return $this->fail('Your sign-in attempt is invalid or has expired. Please try again.');
        }

        if (time() - (int) ($flow['created_at'] ?? 0) > self::FLOW_TTL_SECONDS) {
            return $this->fail('Your sign-in attempt took too long. Please try again.');
        }

        if ($request->filled('error')) {
            // Only echo the (sanitised) error code, never free text from the URL.
            $error = substr((string) preg_replace('/[^A-Za-z0-9_.-]/', '', (string) $request->query('error')), 0, 64);

            Log::warning('OIDC provider returned an error', [
                'config_id' => $ssoConfiguration->id,
                'error' => $error,
            ]);

            return $this->fail('Sign-in was not completed by the identity provider ('.($error ?: 'unknown error').').');
        }

        $code = $request->query('code');

        if (! is_string($code) || $code === '') {
            return $this->fail('The identity provider did not return an authorization code.');
        }

        try {
            $identity = $this->oidc->completeLogin(
                $ssoConfiguration,
                $code,
                (string) $flow['code_verifier'],
                (string) $flow['nonce'],
            );
        } catch (OidcException $e) {
            $this->logFailure('OIDC authentication failed', $ssoConfiguration, $e);

            return $this->fail('SSO authentication failed: '.$e->getMessage());
        }

        try {
            $user = ResolveOidcUser::run($ssoConfiguration, $identity);
        } catch (OidcException $e) {
            $this->logFailure('OIDC user could not be signed in', $ssoConfiguration, $e);

            return $this->fail($e->getMessage());
        }

        Auth::login($user, true);
        $request->session()->regenerate();

        if ($ssoConfiguration->end_session_enabled) {
            $request->session()->put(self::LOGOUT_SESSION_KEY, [
                'config_id' => $ssoConfiguration->id,
                'id_token' => $identity['id_token'],
            ]);
        }

        Log::info('OIDC authentication successful', [
            'config_id' => $ssoConfiguration->id,
            'config_name' => $ssoConfiguration->name,
            'sub' => $identity['sub'],
            'user_id' => $user->id,
        ]);

        return redirect()->to($this->intendedUrl($request));
    }

    private function isUsable(SsoConfiguration $config): bool
    {
        return $config->isOidc() && $config->is_active;
    }

    private function fail(string $message): RedirectResponse
    {
        return redirect()->route('login')->with('error', $message);
    }

    private function logFailure(string $message, SsoConfiguration $config, OidcException $e): void
    {
        Log::warning($message, [
            'config_id' => $config->id,
            'config_name' => $config->name,
            'error' => $e->getMessage(),
            ...$e->context,
        ]);
    }

    /**
     * The URL the user wanted before being sent to log in, but only if it
     * points back at this app. Anything else falls back to the dashboard.
     */
    private function intendedUrl(Request $request): string
    {
        $fallback = route('dashboard');
        $intended = $request->session()->pull('url.intended');

        if (! is_string($intended) || $intended === '' || preg_match('/[\x00-\x1F\\\\]/', $intended)) {
            return $fallback;
        }

        if (str_starts_with($intended, '/')) {
            return str_starts_with($intended, '//') ? $fallback : $intended;
        }

        $parts = parse_url($intended);

        if (! is_array($parts) || ! in_array(strtolower($parts['scheme'] ?? ''), ['http', 'https'], true)) {
            return $fallback;
        }

        $host = strtolower($parts['host'] ?? '');
        $trustedHosts = array_filter([
            strtolower((string) parse_url((string) config('app.url'), PHP_URL_HOST)),
            strtolower($request->getHost()),
        ]);

        return $host !== '' && ! isset($parts['user']) && in_array($host, $trustedHosts, true)
            ? $intended
            : $fallback;
    }
}
