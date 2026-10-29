<?php

namespace App\Services;

use App\Exceptions\OidcException;
use App\Models\SsoConfiguration;
use Firebase\JWT\BeforeValidException;
use Firebase\JWT\ExpiredException;
use Firebase\JWT\JWK;
use Firebase\JWT\JWT;
use Firebase\JWT\Key;
use Firebase\JWT\SignatureInvalidException;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

/**
 * OpenID Connect relying-party logic: discovery, authorization requests
 * (Authorization Code + PKCE S256), token exchange, ID token verification
 * and claim mapping.
 *
 * This class is resolved fresh per call site and keeps no per-request state:
 * flow state (state / nonce / code_verifier) lives in the session, and
 * discovery documents and JWKS live in the cache. Safe under Octane.
 */
class OidcService
{
    /** Allowed clock skew for exp / iat / nbf, in seconds. */
    public const LEEWAY_SECONDS = 60;

    public const DISCOVERY_TTL_SECONDS = 3600;

    public const JWKS_TTL_SECONDS = 3600;

    /** Minimum gap between forced JWKS refetches triggered by an unknown kid. */
    private const JWKS_REFRESH_COOLDOWN_SECONDS = 60;

    private const HTTP_TIMEOUT_SECONDS = 10;

    public const ASYMMETRIC_ALGORITHMS = ['RS256', 'RS384', 'RS512', 'PS256', 'ES256', 'ES384', 'EdDSA'];

    /** HMAC algorithms, keyed with the client secret. Only used when explicitly allowed. */
    public const SYMMETRIC_ALGORITHMS = ['HS256', 'HS384', 'HS512'];

    public const SUPPORTED_ALGORITHMS = [...self::ASYMMETRIC_ALGORITHMS, ...self::SYMMETRIC_ALGORITHMS];

    private const DEFAULT_CLAIM_MAPPING = [
        'email' => 'email',
        'name' => 'name',
    ];

    /** Hash used for at_hash per signing algorithm (OIDC Core 3.1.3.6). */
    private const AT_HASH_ALGORITHMS = [
        'RS256' => 'sha256', 'PS256' => 'sha256', 'ES256' => 'sha256', 'HS256' => 'sha256',
        'RS384' => 'sha384', 'ES384' => 'sha384', 'HS384' => 'sha384',
        'RS512' => 'sha512', 'HS512' => 'sha512', 'EdDSA' => 'sha512',
    ];

    // ------------------------------------------------------------------
    // Discovery & JWKS
    // ------------------------------------------------------------------

    /**
     * Fetch (or read from cache) the provider's discovery document.
     *
     * @return array{issuer: string, authorization_endpoint: string, token_endpoint: string, jwks_uri: string, userinfo_endpoint: ?string, end_session_endpoint: ?string, token_endpoint_auth_methods_supported: ?array, code_challenge_methods_supported: ?array, response_types_supported: ?array, id_token_signing_alg_values_supported: ?array}
     */
    public function discover(SsoConfiguration $config, bool $fresh = false): array
    {
        $issuer = $this->configuredIssuer($config);
        $cacheKey = self::discoveryCacheKey($issuer);

        if ($fresh) {
            Cache::forget($cacheKey);
        }

        return Cache::remember(
            $cacheKey,
            self::DISCOVERY_TTL_SECONDS,
            fn () => $this->fetchDiscovery($issuer),
        );
    }

    /**
     * Drop cached discovery + JWKS for an issuer (e.g. after a config edit).
     */
    public function forgetCache(?string $issuer): void
    {
        $issuer = trim((string) $issuer);

        if ($issuer === '') {
            return;
        }

        $cacheKey = self::discoveryCacheKey($issuer);
        $discovery = Cache::get($cacheKey);

        if (is_array($discovery) && isset($discovery['jwks_uri'])) {
            Cache::forget(self::jwksCacheKey($discovery['jwks_uri']));
        }

        Cache::forget($cacheKey);
    }

    /**
     * @return list<array<string, mixed>> Public signing keys from the JWKS.
     */
    public function jwks(array $discovery, bool $fresh = false): array
    {
        $cacheKey = self::jwksCacheKey($discovery['jwks_uri']);

        if ($fresh) {
            Cache::forget($cacheKey);
        }

        return Cache::remember(
            $cacheKey,
            self::JWKS_TTL_SECONDS,
            fn () => $this->fetchJwks($discovery['jwks_uri']),
        );
    }

    // ------------------------------------------------------------------
    // Authorization request
    // ------------------------------------------------------------------

    /**
     * Build the authorize URL plus the secrets the callback must check.
     *
     * @return array{url: string, state: string, nonce: string, code_verifier: string}
     */
    public function buildAuthorizationRequest(SsoConfiguration $config): array
    {
        $discovery = $this->discover($config);

        $state = Str::random(64);
        $nonce = Str::random(64);
        // RFC 7636: 43-128 chars of [A-Za-z0-9-._~]. Str::random is alphanumeric.
        $codeVerifier = Str::random(96);

        $query = http_build_query([
            'response_type' => 'code',
            'client_id' => $config->client_id,
            'redirect_uri' => $config->oidcRedirectUri(),
            'scope' => self::normalizeScopes($config->scopes),
            'state' => $state,
            'nonce' => $nonce,
            'code_challenge' => self::codeChallenge($codeVerifier),
            'code_challenge_method' => 'S256',
        ], '', '&', PHP_QUERY_RFC3986);

        return [
            'url' => self::appendQuery($discovery['authorization_endpoint'], $query),
            'state' => $state,
            'nonce' => $nonce,
            'code_verifier' => $codeVerifier,
        ];
    }

    public static function codeChallenge(string $codeVerifier): string
    {
        return JWT::urlsafeB64Encode(hash('sha256', $codeVerifier, true));
    }

    // ------------------------------------------------------------------
    // Callback: token exchange, ID token verification, userinfo
    // ------------------------------------------------------------------

    /**
     * Run the whole callback: exchange the code, verify the ID token,
     * optionally merge userinfo, and map claims onto user fields.
     *
     * @return array{provider_user_id: string, sub: string, email: ?string, email_verified: bool, name: ?string, id_token: string}
     */
    public function completeLogin(SsoConfiguration $config, string $code, string $codeVerifier, string $nonce): array
    {
        $discovery = $this->discover($config);
        $tokens = $this->exchangeCode($config, $discovery, $code, $codeVerifier);

        $accessToken = is_string($tokens['access_token'] ?? null) ? $tokens['access_token'] : null;
        $claims = $this->validateIdToken($config, $discovery, $tokens['id_token'], $nonce, $accessToken);

        if ($config->fetch_userinfo && $accessToken !== null && ! empty($discovery['userinfo_endpoint'])) {
            // ID token claims win; userinfo only fills gaps (e.g. email when
            // the IdP keeps ID tokens small).
            $claims = $claims + $this->fetchUserInfo($discovery, $accessToken, $claims['sub']);
        }

        return [
            ...$this->mapClaims($config, $discovery['issuer'], $claims),
            'id_token' => $tokens['id_token'],
        ];
    }

    /**
     * @return array<string, mixed> The token endpoint's JSON response (contains id_token).
     */
    public function exchangeCode(SsoConfiguration $config, array $discovery, string $code, string $codeVerifier): array
    {
        $params = [
            'grant_type' => 'authorization_code',
            'code' => $code,
            'redirect_uri' => $config->oidcRedirectUri(),
            'code_verifier' => $codeVerifier,
        ];

        $request = $this->http()->asForm();

        if (self::tokenEndpointAuthMethod($discovery) === 'client_secret_post') {
            $params['client_id'] = $config->client_id;
            $params['client_secret'] = (string) $config->client_secret;
        } else {
            // RFC 6749 2.3.1: form-encode credentials before Basic auth.
            $request = $request->withBasicAuth(
                urlencode((string) $config->client_id),
                urlencode((string) $config->client_secret),
            );
        }

        $response = $this->send(fn () => $request->post($discovery['token_endpoint'], $params), 'token endpoint');

        if (! $response->successful()) {
            throw new OidcException('The identity provider rejected the authorization code.', [
                'status' => $response->status(),
                // Only the standard error fields; never the raw body.
                'error' => Str::limit((string) $response->json('error'), 100),
                'error_description' => Str::limit((string) $response->json('error_description'), 300),
            ]);
        }

        $tokens = $response->json();

        if (! is_array($tokens) || ! is_string($tokens['id_token'] ?? null) || $tokens['id_token'] === '') {
            throw new OidcException('The identity provider did not return an ID token.');
        }

        return $tokens;
    }

    /**
     * Verify the ID token's signature and claims (OIDC Core 3.1.3.7).
     *
     * @return array<string, mixed> The verified claims.
     */
    public function validateIdToken(
        SsoConfiguration $config,
        array $discovery,
        string $idToken,
        string $expectedNonce,
        ?string $accessToken = null,
    ): array {
        $segments = explode('.', $idToken);

        if (count($segments) !== 3) {
            throw new OidcException('The ID token is malformed.');
        }

        $header = json_decode(JWT::urlsafeB64Decode($segments[0]), true);
        $alg = is_array($header) ? ($header['alg'] ?? null) : null;

        // Explicit allow-list check before touching any key material: this is
        // what rejects "none" and HS* (unless an admin opted in).
        if (! is_string($alg) || ! in_array($alg, $this->allowedAlgorithms($config), true)) {
            throw new OidcException('The ID token is signed with an algorithm that is not allowed.', [
                'alg' => is_string($alg) ? Str::limit($alg, 20) : null,
            ]);
        }

        $kid = is_array($header) && isset($header['kid']) && is_string($header['kid']) ? $header['kid'] : null;
        $key = $this->verificationKey($config, $discovery, $alg, $kid);

        // JWT::$leeway is a process-wide static. The value is a constant, not
        // request data, but restore it anyway so nothing else is affected.
        $previousLeeway = JWT::$leeway;
        JWT::$leeway = self::LEEWAY_SECONDS;

        try {
            $payload = JWT::decode($idToken, $key);
        } catch (ExpiredException) {
            throw new OidcException('The ID token has expired. Check that the server clock is correct.');
        } catch (BeforeValidException) {
            throw new OidcException('The ID token is not valid yet. Check that the server clock is correct.');
        } catch (SignatureInvalidException) {
            throw new OidcException('The ID token signature is invalid.', ['kid' => $kid]);
        } catch (\UnexpectedValueException|\DomainException|\InvalidArgumentException $e) {
            throw new OidcException('The ID token could not be verified.', ['reason' => $e->getMessage()]);
        } finally {
            JWT::$leeway = $previousLeeway;
        }

        $claims = json_decode(json_encode($payload), true) ?: [];
        $now = time();

        if (($claims['iss'] ?? null) !== $discovery['issuer']) {
            throw new OidcException('The ID token was issued by an unexpected issuer.', [
                'expected' => $discovery['issuer'],
                'actual' => is_string($claims['iss'] ?? null) ? Str::limit($claims['iss'], 200) : null,
            ]);
        }

        $audiences = $claims['aud'] ?? null;
        $audiences = is_string($audiences) ? [$audiences] : (is_array($audiences) ? $audiences : []);

        if (! in_array($config->client_id, $audiences, true)) {
            throw new OidcException('The ID token was not issued for this application (audience mismatch).');
        }

        $azp = $claims['azp'] ?? null;

        if ((count($audiences) > 1 || $azp !== null) && $azp !== $config->client_id) {
            throw new OidcException('The ID token was not issued for this application (authorized party mismatch).');
        }

        if (! is_numeric($claims['exp'] ?? null)) {
            throw new OidcException('The ID token has no expiry.');
        }

        if (! is_numeric($claims['iat'] ?? null)) {
            throw new OidcException('The ID token has no issue time.');
        }

        // php-jwt skips the iat check when nbf is present; enforce it ourselves.
        if ((int) floor((float) $claims['iat']) > $now + self::LEEWAY_SECONDS) {
            throw new OidcException('The ID token is not valid yet. Check that the server clock is correct.');
        }

        $nonce = $claims['nonce'] ?? null;

        if (! is_string($nonce) || ! hash_equals($expectedNonce, $nonce)) {
            throw new OidcException('The ID token nonce does not match this sign-in attempt.');
        }

        $sub = $claims['sub'] ?? null;

        if (! is_string($sub) || trim($sub) === '' || strlen($sub) > 255) {
            throw new OidcException('The ID token has no valid subject (sub) claim.');
        }

        if ($accessToken !== null && isset($claims['at_hash'])) {
            $this->verifyAtHash($alg, $accessToken, $claims['at_hash']);
        }

        return $claims;
    }

    /**
     * @return array<string, mixed> Userinfo claims, or [] if unavailable.
     */
    public function fetchUserInfo(array $discovery, string $accessToken, string $expectedSub): array
    {
        try {
            $response = $this->http()->withToken($accessToken)->get($discovery['userinfo_endpoint']);
        } catch (ConnectionException) {
            Log::warning('OIDC userinfo request failed to connect', ['issuer' => $discovery['issuer']]);

            return [];
        }

        $claims = $response->successful() ? $response->json() : null;

        if (! is_array($claims)) {
            // Non-fatal: the ID token already carries the essentials. Signed
            // (application/jwt) userinfo responses are not supported.
            Log::warning('OIDC userinfo response was not usable', [
                'issuer' => $discovery['issuer'],
                'status' => $response->status(),
            ]);

            return [];
        }

        // OIDC Core 5.3.2: the userinfo sub MUST match the ID token sub.
        if (($claims['sub'] ?? null) !== $expectedSub) {
            throw new OidcException('The userinfo response does not belong to the signed-in user.');
        }

        return $claims;
    }

    /**
     * Map verified claims onto PulseBoard user fields.
     *
     * @return array{provider_user_id: string, sub: string, email: ?string, email_verified: bool, name: ?string}
     */
    public function mapClaims(SsoConfiguration $config, string $issuer, array $claims): array
    {
        $mapping = $this->claimMapping($config);
        $sub = (string) $claims['sub'];

        $email = self::claimString($claims, $mapping['email']);
        $email = $email !== null && filter_var($email, FILTER_VALIDATE_EMAIL) ? $email : null;

        // email_verified describes the standard "email" claim only. If the
        // admin maps email to some other claim (upn, preferred_username...)
        // we cannot know whether it was verified, so treat it as unverified.
        $verifiedFlag = $claims['email_verified'] ?? null;
        $emailVerified = $email !== null
            && $mapping['email'] === 'email'
            && ($verifiedFlag === true || $verifiedFlag === 'true');

        return [
            'provider_user_id' => self::providerUserId($issuer, $sub),
            'sub' => $sub,
            'email' => $email,
            'email_verified' => $emailVerified,
            'name' => $this->resolveName($claims, $mapping['name']),
        ];
    }

    /**
     * Stable identifier stored in users.auth_provider_id: a short issuer
     * fingerprint plus the subject. "sub" is only unique per issuer, so the
     * issuer must be part of the key; hashing keeps it within 255 chars.
     */
    public static function providerUserId(string $issuer, string $sub): string
    {
        $prefix = substr(hash('sha256', $issuer), 0, 16).':';

        return strlen($prefix.$sub) <= 255
            ? $prefix.$sub
            : $prefix.'sha256:'.hash('sha256', $sub);
    }

    // ------------------------------------------------------------------
    // Logout
    // ------------------------------------------------------------------

    /**
     * RP-initiated logout URL, or null when unsupported or disabled.
     */
    public function endSessionUrl(SsoConfiguration $config, string $idToken): ?string
    {
        if (! $config->end_session_enabled) {
            return null;
        }

        $endpoint = $this->discover($config)['end_session_endpoint'] ?? null;

        if (! $endpoint) {
            return null;
        }

        return self::appendQuery($endpoint, http_build_query([
            'id_token_hint' => $idToken,
            'post_logout_redirect_uri' => SsoConfiguration::oidcPostLogoutRedirectUri(),
            'client_id' => $config->client_id,
        ], '', '&', PHP_QUERY_RFC3986));
    }

    // ------------------------------------------------------------------
    // Admin "Test connection"
    // ------------------------------------------------------------------

    /**
     * Fetch and validate discovery + JWKS fresh (bypassing the cache).
     *
     * @return array{success: bool, message: string, checks: list<array{label: string, ok: bool, detail: string}>}
     */
    public function testConfiguration(SsoConfiguration $config): array
    {
        $checks = [];

        try {
            $discovery = $this->discover($config, fresh: true);
        } catch (OidcException $e) {
            return [
                'success' => false,
                'message' => $e->getMessage(),
                'checks' => [['label' => 'Discovery document', 'ok' => false, 'detail' => $e->getMessage()]],
            ];
        }

        $checks[] = ['label' => 'Discovery document', 'ok' => true, 'detail' => 'Issuer '.$discovery['issuer']];

        $responseTypes = $discovery['response_types_supported'];
        $checks[] = [
            'label' => 'Authorization code flow',
            'ok' => $responseTypes === null || in_array('code', $responseTypes, true),
            'detail' => $responseTypes === null
                ? 'Not advertised; assuming supported'
                : 'Supported: '.implode(', ', $responseTypes),
        ];

        $pkceMethods = $discovery['code_challenge_methods_supported'];
        $checks[] = [
            'label' => 'PKCE (S256)',
            'ok' => $pkceMethods === null || in_array('S256', $pkceMethods, true),
            'detail' => $pkceMethods === null
                ? 'Not advertised; most providers accept it anyway'
                : 'Supported: '.implode(', ', $pkceMethods),
        ];

        $allowed = $this->allowedAlgorithms($config);
        $advertised = $discovery['id_token_signing_alg_values_supported'];
        $usable = $advertised === null ? $allowed : array_values(array_intersect($advertised, $allowed));
        $checks[] = [
            'label' => 'ID token signing algorithm',
            'ok' => $usable !== [],
            'detail' => $usable !== []
                ? 'Usable: '.implode(', ', $usable)
                : 'Provider signs with '.implode(', ', $advertised ?? []).'; allowed here: '.implode(', ', $allowed),
        ];

        if (array_diff($allowed, self::SYMMETRIC_ALGORITHMS) !== []) {
            try {
                $keys = $this->jwks($discovery, fresh: true);
                $compatible = array_filter(
                    $keys,
                    fn (array $jwk) => collect($allowed)->contains(fn (string $alg) => self::jwkSupportsAlgorithm($jwk, $alg)),
                );
                $checks[] = [
                    'label' => 'Signing keys (JWKS)',
                    'ok' => $compatible !== [],
                    'detail' => count($compatible).' usable of '.count($keys).' published',
                ];
            } catch (OidcException $e) {
                $checks[] = ['label' => 'Signing keys (JWKS)', 'ok' => false, 'detail' => $e->getMessage()];
            }
        }

        if ($config->fetch_userinfo) {
            $checks[] = [
                'label' => 'Userinfo endpoint',
                'ok' => true,
                'detail' => $discovery['userinfo_endpoint'] ? 'Available' : 'Not published; ID token claims only',
            ];
        }

        if ($config->end_session_enabled) {
            $checks[] = [
                'label' => 'Single logout (end_session_endpoint)',
                'ok' => (bool) $discovery['end_session_endpoint'],
                'detail' => $discovery['end_session_endpoint']
                    ? 'Available'
                    : 'Provider does not publish an end_session_endpoint',
            ];
        }

        $failed = array_values(array_filter($checks, fn ($check) => ! $check['ok']));

        return [
            'success' => $failed === [],
            'message' => $failed === []
                ? 'OIDC discovery and signing keys look good.'
                : $failed[0]['label'].': '.$failed[0]['detail'],
            'checks' => $checks,
        ];
    }

    // ------------------------------------------------------------------
    // Helpers
    // ------------------------------------------------------------------

    /**
     * @return list<string>
     */
    public function allowedAlgorithms(SsoConfiguration $config): array
    {
        $configured = array_values(array_intersect(
            self::SUPPORTED_ALGORITHMS,
            (array) ($config->allowed_algorithms ?? []),
        ));

        return $configured !== [] ? $configured : self::ASYMMETRIC_ALGORITHMS;
    }

    /**
     * Space-separated scopes, always including "openid".
     */
    public static function normalizeScopes(?string $scopes): string
    {
        $list = preg_split('/[\s,]+/', trim((string) $scopes), -1, PREG_SPLIT_NO_EMPTY) ?: [];

        if ($list === []) {
            $list = explode(' ', SsoConfiguration::DEFAULT_OIDC_SCOPES);
        }

        return implode(' ', array_values(array_unique(['openid', ...$list])));
    }

    public static function allowsInsecureUrls(): bool
    {
        return app()->environment('local');
    }

    private function configuredIssuer(SsoConfiguration $config): string
    {
        $issuer = trim((string) $config->issuer);

        if ($issuer === '' || ! $config->client_id) {
            throw new OidcException('This OIDC provider is missing its issuer or client ID.');
        }

        return $issuer;
    }

    private function fetchDiscovery(string $issuer): array
    {
        $url = rtrim($issuer, '/').'/.well-known/openid-configuration';
        $response = $this->send(fn () => $this->http()->get($url), 'discovery document');

        if (! $response->successful()) {
            throw new OidcException('Could not load the discovery document (HTTP '.$response->status().').', [
                'url' => $url,
            ]);
        }

        $document = $response->json();

        if (! is_array($document)) {
            throw new OidcException('The discovery document is not valid JSON.', ['url' => $url]);
        }

        // OIDC Discovery 4.3: the document's issuer must match the one we
        // asked for. Tolerate only a trailing-slash difference, then treat the
        // document's exact value as the expected "iss" in ID tokens.
        $documentIssuer = $document['issuer'] ?? null;

        if (! is_string($documentIssuer) || rtrim($documentIssuer, '/') !== rtrim($issuer, '/')) {
            throw new OidcException('Issuer mismatch: the discovery document reports "'
                .Str::limit((string) (is_string($documentIssuer) ? $documentIssuer : ''), 200)
                .'" but this provider is configured with "'.$issuer.'".');
        }

        $result = ['issuer' => $documentIssuer];

        foreach (['authorization_endpoint', 'token_endpoint', 'jwks_uri'] as $field) {
            $result[$field] = $this->validEndpoint($document[$field] ?? null, $field, required: true);
        }

        foreach (['userinfo_endpoint', 'end_session_endpoint'] as $field) {
            $result[$field] = $this->validEndpoint($document[$field] ?? null, $field, required: false);
        }

        foreach ([
            'token_endpoint_auth_methods_supported',
            'code_challenge_methods_supported',
            'response_types_supported',
            'id_token_signing_alg_values_supported',
        ] as $field) {
            $result[$field] = isset($document[$field]) && is_array($document[$field])
                ? array_values(array_filter($document[$field], 'is_string'))
                : null;
        }

        return $result;
    }

    private function fetchJwks(string $uri): array
    {
        $response = $this->send(fn () => $this->http()->get($uri), 'JWKS');
        $keys = $response->successful() ? $response->json('keys') : null;

        if (! is_array($keys)) {
            throw new OidcException('Could not load the provider\'s signing keys (JWKS).', [
                'status' => $response->status(),
            ]);
        }

        // Keep public signature keys only. Symmetric ("oct") keys or private
        // key material in a JWKS are never trusted.
        return array_values(array_filter($keys, fn ($jwk) => is_array($jwk)
            && in_array($jwk['kty'] ?? null, ['RSA', 'EC', 'OKP'], true)
            && ! isset($jwk['d'])
            && (! isset($jwk['use']) || $jwk['use'] === 'sig')));
    }

    private function verificationKey(SsoConfiguration $config, array $discovery, string $alg, ?string $kid): Key
    {
        if (in_array($alg, self::SYMMETRIC_ALGORITHMS, true)) {
            $secret = (string) $config->client_secret;

            if ($secret === '') {
                throw new OidcException('HMAC-signed ID tokens need a client secret.');
            }

            return new Key($secret, $alg);
        }

        $jwk = $this->findJwk($this->jwks($discovery), $alg, $kid);

        // Unknown kid: the IdP probably rotated keys. Refetch once, with a
        // cooldown so forged kids can't make us hammer the IdP.
        if ($jwk === null && $kid !== null
            && Cache::add(self::jwksCacheKey($discovery['jwks_uri']).':refresh', true, self::JWKS_REFRESH_COOLDOWN_SECONDS)) {
            $jwk = $this->findJwk($this->jwks($discovery, fresh: true), $alg, $kid);
        }

        if ($jwk === null) {
            throw new OidcException('No matching signing key was found for the ID token.', ['kid' => $kid, 'alg' => $alg]);
        }

        try {
            $key = JWK::parseKey($jwk, $alg);
        } catch (\Throwable $e) {
            throw new OidcException('The provider\'s signing key could not be parsed.', ['kid' => $kid, 'reason' => $e->getMessage()]);
        }

        if ($key === null) {
            throw new OidcException('The provider\'s signing key type is not supported.', ['kid' => $kid]);
        }

        return $key;
    }

    private function findJwk(array $keys, string $alg, ?string $kid): ?array
    {
        $candidates = array_values(array_filter($keys, fn (array $jwk) => self::jwkSupportsAlgorithm($jwk, $alg)));

        if ($kid !== null) {
            foreach ($candidates as $jwk) {
                if (($jwk['kid'] ?? null) === $kid) {
                    return $jwk;
                }
            }

            return null;
        }

        // No kid in the header: only unambiguous if there is exactly one key.
        return count($candidates) === 1 ? $candidates[0] : null;
    }

    private static function jwkSupportsAlgorithm(array $jwk, string $alg): bool
    {
        if (isset($jwk['alg']) && $jwk['alg'] !== $alg) {
            return false;
        }

        return match (true) {
            str_starts_with($alg, 'RS'), $alg === 'PS256' => ($jwk['kty'] ?? null) === 'RSA',
            $alg === 'ES256' => ($jwk['kty'] ?? null) === 'EC' && ($jwk['crv'] ?? null) === 'P-256',
            $alg === 'ES384' => ($jwk['kty'] ?? null) === 'EC' && ($jwk['crv'] ?? null) === 'P-384',
            $alg === 'EdDSA' => ($jwk['kty'] ?? null) === 'OKP' && ($jwk['crv'] ?? null) === 'Ed25519',
            default => false,
        };
    }

    private function verifyAtHash(string $alg, string $accessToken, mixed $atHash): void
    {
        $hashAlgo = self::AT_HASH_ALGORITHMS[$alg] ?? null;

        if ($hashAlgo === null) {
            return;
        }

        $digest = hash($hashAlgo, $accessToken, true);
        $expected = JWT::urlsafeB64Encode(substr($digest, 0, intdiv(strlen($digest), 2)));

        if (! is_string($atHash) || ! hash_equals($expected, $atHash)) {
            throw new OidcException('The access token does not match the ID token (at_hash mismatch).');
        }
    }

    private function claimMapping(SsoConfiguration $config): array
    {
        $mapping = self::DEFAULT_CLAIM_MAPPING;

        foreach ($config->attribute_mapping ?? [] as $field => $claim) {
            if (array_key_exists($field, $mapping) && is_string($claim) && trim($claim) !== '') {
                $mapping[$field] = trim($claim);
            }
        }

        return $mapping;
    }

    private function resolveName(array $claims, string $mappedClaim): ?string
    {
        $name = self::claimString($claims, $mappedClaim) ?? self::claimString($claims, 'name');

        if ($name === null) {
            $parts = array_filter([
                self::claimString($claims, 'given_name'),
                self::claimString($claims, 'family_name'),
            ]);
            $name = $parts !== [] ? implode(' ', $parts) : null;
        }

        $name ??= self::claimString($claims, 'preferred_username') ?? self::claimString($claims, 'nickname');

        return $name !== null ? Str::limit($name, 255, '') : null;
    }

    /**
     * Read a claim as a trimmed string. Exact key first (claim names may
     * contain dots, e.g. URLs), then dot-notation for nested claims.
     */
    private static function claimString(array $claims, string $claim): ?string
    {
        $value = array_key_exists($claim, $claims) ? $claims[$claim] : data_get($claims, $claim);

        if (is_array($value)) {
            $value = collect($value)->first(fn ($item) => is_scalar($item) && trim((string) $item) !== '');
        }

        if (! is_scalar($value)) {
            return null;
        }

        $value = trim((string) $value);

        return $value !== '' ? $value : null;
    }

    private static function tokenEndpointAuthMethod(array $discovery): string
    {
        // Spec default when the provider doesn't say is client_secret_basic.
        $methods = $discovery['token_endpoint_auth_methods_supported'] ?? null;

        if ($methods === null || in_array('client_secret_basic', $methods, true)) {
            return 'client_secret_basic';
        }

        return in_array('client_secret_post', $methods, true) ? 'client_secret_post' : 'client_secret_basic';
    }

    private function validEndpoint(mixed $url, string $field, bool $required): ?string
    {
        if ($url === null || $url === '') {
            if ($required) {
                throw new OidcException("The discovery document has no {$field}.");
            }

            return null;
        }

        $scheme = is_string($url) ? strtolower((string) parse_url($url, PHP_URL_SCHEME)) : '';
        $allowedSchemes = self::allowsInsecureUrls() ? ['https', 'http'] : ['https'];

        if (! is_string($url) || ! filter_var($url, FILTER_VALIDATE_URL) || ! in_array($scheme, $allowedSchemes, true)) {
            throw new OidcException("The discovery document's {$field} is not a valid HTTPS URL.");
        }

        return $url;
    }

    private function http(): PendingRequest
    {
        return Http::acceptJson()->timeout(self::HTTP_TIMEOUT_SECONDS)->withoutRedirecting();
    }

    /**
     * @param  callable(): Response  $request
     */
    private function send(callable $request, string $what): Response
    {
        try {
            return $request();
        } catch (ConnectionException $e) {
            throw new OidcException("Could not reach the identity provider's {$what}.", ['reason' => $e->getMessage()], $e);
        }
    }

    private static function appendQuery(string $url, string $query): string
    {
        return $url.(str_contains($url, '?') ? '&' : '?').$query;
    }

    private static function discoveryCacheKey(string $issuer): string
    {
        return 'oidc:discovery:'.sha1(rtrim($issuer, '/'));
    }

    private static function jwksCacheKey(string $jwksUri): string
    {
        return 'oidc:jwks:'.sha1($jwksUri);
    }
}
