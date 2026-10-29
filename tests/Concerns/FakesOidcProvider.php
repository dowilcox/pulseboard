<?php

namespace Tests\Concerns;

use App\Models\SsoConfiguration;
use Firebase\JWT\JWT;
use Illuminate\Support\Facades\Http;

/**
 * A fake OpenID Connect provider for feature tests: real RSA keys, a real
 * JWKS, and signed ID tokens, served through Http::fake(). No network.
 */
trait FakesOidcProvider
{
    protected string $issuer = 'https://idp.example.test/realms/acme';

    protected string $clientId = 'pulseboard-client';

    protected string $clientSecret = 'super-secret-client-value-0123456789';

    protected string $kid = 'key-1';

    /** @var array{private: string, n: string, e: string}|null */
    private static ?array $rsaKey = null;

    /** @var array{private: string, n: string, e: string}|null */
    private static ?array $otherRsaKey = null;

    /** Claims merged into (or, with null values, removed from) the next ID token. */
    protected array $idTokenOverrides = [];

    protected array $idTokenHeaderOverrides = [];

    /** Signs the next ID token with something other than the published key. */
    protected ?\Closure $idTokenSigner = null;

    protected array $userinfoClaims = [];

    protected array $discoveryOverrides = [];

    protected function createOidcConfiguration(array $attributes = []): SsoConfiguration
    {
        return SsoConfiguration::create([
            'provider' => SsoConfiguration::PROVIDER_OIDC,
            'name' => 'Acme IdP',
            'button_label' => 'Acme',
            'issuer' => $this->issuer,
            'client_id' => $this->clientId,
            'client_secret' => $this->clientSecret,
            'scopes' => 'openid profile email',
            'fetch_userinfo' => false,
            'end_session_enabled' => false,
            'is_active' => true,
            ...$attributes,
        ]);
    }

    protected function rsaKey(): array
    {
        return self::$rsaKey ??= self::generateRsaKey();
    }

    protected function otherRsaKey(): array
    {
        return self::$otherRsaKey ??= self::generateRsaKey();
    }

    private static function generateRsaKey(): array
    {
        $resource = openssl_pkey_new([
            'private_key_bits' => 2048,
            'private_key_type' => OPENSSL_KEYTYPE_RSA,
        ]);
        openssl_pkey_export($resource, $privatePem);
        $details = openssl_pkey_get_details($resource);

        return [
            'private' => $privatePem,
            'n' => JWT::urlsafeB64Encode($details['rsa']['n']),
            'e' => JWT::urlsafeB64Encode($details['rsa']['e']),
        ];
    }

    protected function jwks(): array
    {
        return ['keys' => [[
            'kty' => 'RSA',
            'kid' => $this->kid,
            'use' => 'sig',
            'alg' => 'RS256',
            'n' => $this->rsaKey()['n'],
            'e' => $this->rsaKey()['e'],
        ]]];
    }

    protected function discoveryDocument(): array
    {
        return [
            'issuer' => $this->issuer,
            'authorization_endpoint' => $this->issuer.'/protocol/openid-connect/auth',
            'token_endpoint' => $this->issuer.'/protocol/openid-connect/token',
            'jwks_uri' => $this->issuer.'/protocol/openid-connect/certs',
            'userinfo_endpoint' => $this->issuer.'/protocol/openid-connect/userinfo',
            'end_session_endpoint' => $this->issuer.'/protocol/openid-connect/logout',
            'response_types_supported' => ['code'],
            'code_challenge_methods_supported' => ['S256'],
            'id_token_signing_alg_values_supported' => ['RS256'],
            'token_endpoint_auth_methods_supported' => ['client_secret_basic', 'client_secret_post'],
            ...$this->discoveryOverrides,
        ];
    }

    protected function defaultClaims(string $nonce): array
    {
        $now = time();

        return [
            'iss' => $this->issuer,
            'aud' => $this->clientId,
            'sub' => 'user-sub-123',
            'iat' => $now,
            'exp' => $now + 300,
            'nonce' => $nonce,
            'email' => 'ada@example.com',
            'email_verified' => true,
            'name' => 'Ada Lovelace',
        ];
    }

    protected function makeIdToken(string $nonce): string
    {
        $claims = array_filter(
            [...$this->defaultClaims($nonce), ...$this->idTokenOverrides],
            fn ($value) => $value !== null,
        );

        if ($this->idTokenSigner) {
            return ($this->idTokenSigner)($claims);
        }

        return JWT::encode(
            $claims,
            $this->rsaKey()['private'],
            'RS256',
            $this->idTokenHeaderOverrides['kid'] ?? $this->kid,
        );
    }

    /**
     * Register Http::fake() routes for the whole provider. The token endpoint
     * mints an ID token bound to $nonce at request time.
     */
    protected function fakeOidcProvider(string $nonce = 'test-nonce', ?array $jwks = null): void
    {
        $discovery = $this->discoveryDocument();

        Http::fake([
            $this->issuer.'/.well-known/openid-configuration' => Http::response($discovery),
            $discovery['jwks_uri'] => Http::response($jwks ?? $this->jwks()),
            $discovery['token_endpoint'] => fn () => Http::response([
                'access_token' => 'access-token-value',
                'token_type' => 'Bearer',
                'expires_in' => 300,
                'id_token' => $this->makeIdToken($nonce),
            ]),
            $discovery['userinfo_endpoint'] => fn () => Http::response([
                'sub' => $this->idTokenOverrides['sub'] ?? 'user-sub-123',
                ...$this->userinfoClaims,
            ]),
        ]);
    }

    /**
     * Session data as left behind by the redirect step.
     */
    protected function oidcFlow(SsoConfiguration $config, string $state = 'test-state', string $nonce = 'test-nonce'): array
    {
        return ['oidc_flow' => [
            'config_id' => $config->id,
            'state' => $state,
            'nonce' => $nonce,
            'code_verifier' => str_repeat('v', 64),
            'created_at' => time(),
        ]];
    }
}
