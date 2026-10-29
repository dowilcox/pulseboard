<?php

namespace Tests\Feature\Auth;

use App\Models\AppSetting;
use App\Models\SsoConfiguration;
use App\Models\User;
use App\Services\OidcService;
use Firebase\JWT\JWT;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request as HttpRequest;
use Illuminate\Support\Facades\Http;
use Tests\Concerns\FakesOidcProvider;
use Tests\TestCase;

class OidcAuthenticationTest extends TestCase
{
    use FakesOidcProvider, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        // Full-page Inertia renders need no built assets here.
        $this->withoutVite();
    }

    private function hitCallback(SsoConfiguration $config, array $query = [], ?array $session = null)
    {
        return $this->withSession($session ?? $this->oidcFlow($config))
            ->get(route('oidc.callback', [
                'ssoConfiguration' => $config->id,
                'code' => 'auth-code-xyz',
                'state' => 'test-state',
                ...$query,
            ]));
    }

    private function providerUserId(string $sub = 'user-sub-123'): string
    {
        return OidcService::providerUserId($this->issuer, $sub);
    }

    // ── Redirect ───────────────────────────────────────────────────────

    public function test_redirect_builds_authorization_url_with_pkce_state_and_nonce(): void
    {
        $config = $this->createOidcConfiguration(['scopes' => 'openid email profile groups']);
        $this->fakeOidcProvider();

        $response = $this->get(route('oidc.redirect', $config));

        $location = $response->headers->get('Location');
        $this->assertStringStartsWith($this->issuer.'/protocol/openid-connect/auth?', $location);

        parse_str(parse_url($location, PHP_URL_QUERY), $query);
        $flow = session('oidc_flow');

        $this->assertSame('code', $query['response_type']);
        $this->assertSame($this->clientId, $query['client_id']);
        $this->assertSame($config->oidcRedirectUri(), $query['redirect_uri']);
        $this->assertSame(url('/auth/oidc/'.$config->id.'/callback'), $query['redirect_uri']);
        $this->assertSame('openid email profile groups', $query['scope']);
        $this->assertSame('S256', $query['code_challenge_method']);

        $this->assertSame($config->id, $flow['config_id']);
        $this->assertSame($flow['state'], $query['state']);
        $this->assertSame($flow['nonce'], $query['nonce']);
        $this->assertGreaterThanOrEqual(43, strlen($flow['code_verifier']));
        $this->assertSame(
            rtrim(strtr(base64_encode(hash('sha256', $flow['code_verifier'], true)), '+/', '-_'), '='),
            $query['code_challenge'],
        );
        $this->assertGreaterThanOrEqual(32, strlen($query['state']));
        $this->assertGreaterThanOrEqual(32, strlen($query['nonce']));
    }

    public function test_redirect_refuses_inactive_or_saml_configurations(): void
    {
        $inactive = $this->createOidcConfiguration(['is_active' => false]);

        $this->get(route('oidc.redirect', $inactive))
            ->assertRedirect(route('login'))
            ->assertSessionHas('error', 'SSO is not configured.');

        $saml = SsoConfiguration::create([
            'name' => 'SAML',
            'entity_id' => 'https://saml.example.test',
            'login_url' => 'https://saml.example.test/login',
            'certificate' => 'cert',
            'is_active' => true,
        ]);

        $this->get(route('oidc.redirect', $saml))->assertRedirect(route('login'));
    }

    public function test_redirect_reports_unreachable_discovery(): void
    {
        $config = $this->createOidcConfiguration();
        Http::fake(['*' => Http::response('nope', 500)]);

        $this->get(route('oidc.redirect', $config))
            ->assertRedirect(route('login'))
            ->assertSessionHas('error', fn ($message) => str_contains($message, 'temporarily unavailable'));

        $this->assertNull(session('oidc_flow'));
    }

    // ── Successful callback ────────────────────────────────────────────

    public function test_successful_callback_provisions_and_logs_in_a_new_user(): void
    {
        $config = $this->createOidcConfiguration();
        $this->fakeOidcProvider();

        $response = $this->hitCallback($config);

        $response->assertRedirect(route('dashboard'));
        $this->assertAuthenticated();

        $user = User::where('email', 'ada@example.com')->firstOrFail();
        $this->assertAuthenticatedAs($user);
        $this->assertSame('Ada Lovelace', $user->name);
        $this->assertSame('oidc', $user->auth_provider);
        $this->assertSame($this->providerUserId(), $user->auth_provider_id);
        $this->assertNotNull($user->email_verified_at);
        $this->assertNull($user->password);
        $this->assertNull(session('oidc_flow'), 'The flow must be single-use.');

        Http::assertSent(function (HttpRequest $request) use ($config) {
            if ($request->url() !== $this->issuer.'/protocol/openid-connect/token') {
                return false;
            }

            return $request['grant_type'] === 'authorization_code'
                && $request['code'] === 'auth-code-xyz'
                && $request['code_verifier'] === str_repeat('v', 64)
                && $request['redirect_uri'] === $config->oidcRedirectUri()
                && $request->hasHeader('Authorization', 'Basic '.base64_encode($this->clientId.':'.$this->clientSecret))
                && ! isset($request['client_secret']);
        });
    }

    public function test_client_secret_post_is_used_when_basic_is_not_supported(): void
    {
        $config = $this->createOidcConfiguration();
        $this->discoveryOverrides = ['token_endpoint_auth_methods_supported' => ['client_secret_post']];
        $this->fakeOidcProvider();

        $this->hitCallback($config)->assertRedirect(route('dashboard'));

        Http::assertSent(fn (HttpRequest $request) => str_ends_with($request->url(), '/token')
            && $request['client_id'] === $this->clientId
            && $request['client_secret'] === $this->clientSecret
            && ! $request->hasHeader('Authorization'));
    }

    public function test_existing_oidc_user_is_matched_by_subject(): void
    {
        $config = $this->createOidcConfiguration();
        $user = User::factory()->create([
            'name' => 'Old Name',
            'email' => 'ada.old@example.com',
            'auth_provider' => 'oidc',
            'auth_provider_id' => $this->providerUserId(),
        ]);
        // Same sub, new (unverified) email: still the same account, and the
        // unverified address is not copied over.
        $this->idTokenOverrides = ['email' => 'ada.new@example.com', 'email_verified' => false];
        $this->fakeOidcProvider();

        $this->hitCallback($config)->assertRedirect(route('dashboard'));

        $this->assertAuthenticatedAs($user);
        $user->refresh();
        $this->assertSame('Ada Lovelace', $user->name);
        $this->assertSame('ada.old@example.com', $user->email);
        $this->assertSame(1, User::count());
    }

    public function test_verified_email_change_is_synced_for_linked_user(): void
    {
        $config = $this->createOidcConfiguration();
        $user = User::factory()->create([
            'email' => 'ada.old@example.com',
            'auth_provider' => 'oidc',
            'auth_provider_id' => $this->providerUserId(),
        ]);
        $this->idTokenOverrides = ['email' => 'ada.new@example.com'];
        $this->fakeOidcProvider();

        $this->hitCallback($config)->assertRedirect(route('dashboard'));

        $this->assertSame('ada.new@example.com', $user->refresh()->email);
    }

    public function test_same_sub_from_a_different_issuer_is_a_different_identity(): void
    {
        $config = $this->createOidcConfiguration();
        User::factory()->create([
            'email' => 'someone@example.com',
            'auth_provider' => 'oidc',
            'auth_provider_id' => OidcService::providerUserId('https://other-idp.example.test', 'user-sub-123'),
        ]);
        $this->fakeOidcProvider();

        $this->hitCallback($config)->assertRedirect(route('dashboard'));

        $this->assertSame('ada@example.com', auth()->user()->email);
        $this->assertSame(2, User::count());
    }

    public function test_userinfo_fills_claims_missing_from_the_id_token(): void
    {
        $config = $this->createOidcConfiguration(['fetch_userinfo' => true]);
        $this->idTokenOverrides = ['email' => null, 'email_verified' => null, 'name' => null];
        $this->userinfoClaims = ['email' => 'grace@example.com', 'email_verified' => true, 'name' => 'Grace Hopper'];
        $this->fakeOidcProvider();

        $this->hitCallback($config)->assertRedirect(route('dashboard'));

        $user = User::where('email', 'grace@example.com')->firstOrFail();
        $this->assertSame('Grace Hopper', $user->name);
        Http::assertSent(fn (HttpRequest $request) => str_ends_with($request->url(), '/userinfo')
            && $request->hasHeader('Authorization', 'Bearer access-token-value'));
    }

    public function test_userinfo_with_a_different_subject_is_rejected(): void
    {
        $config = $this->createOidcConfiguration(['fetch_userinfo' => true]);
        $this->userinfoClaims = ['sub' => 'someone-else'];
        $this->fakeOidcProvider();

        $this->hitCallback($config)->assertRedirect(route('login'));

        $this->assertGuest();
    }

    public function test_custom_claim_mapping_is_used(): void
    {
        $config = $this->createOidcConfiguration([
            'attribute_mapping' => ['email' => 'upn', 'name' => 'display_name'],
        ]);
        $this->idTokenOverrides = ['upn' => 'upn.user@example.com', 'display_name' => 'Display Name'];
        $this->fakeOidcProvider();

        $this->hitCallback($config)->assertRedirect(route('dashboard'));

        $user = User::where('email', 'upn.user@example.com')->firstOrFail();
        $this->assertSame('Display Name', $user->name);
        // email_verified only describes the standard "email" claim.
        $this->assertNull($user->email_verified_at);
    }

    public function test_jwks_is_refetched_when_the_key_id_is_unknown(): void
    {
        $config = $this->createOidcConfiguration();
        $this->kid = 'rotated-key';
        $staleJwks = ['keys' => [['kty' => 'RSA', 'kid' => 'old-key', 'alg' => 'RS256', 'use' => 'sig',
            'n' => $this->otherRsaKey()['n'], 'e' => $this->otherRsaKey()['e']]]];
        $discovery = $this->discoveryDocument();

        Http::fake([
            $this->issuer.'/.well-known/openid-configuration' => Http::response($discovery),
            $discovery['jwks_uri'] => Http::sequence()
                ->push($staleJwks)
                ->push($this->jwks()),
            $discovery['token_endpoint'] => fn () => Http::response([
                'access_token' => 'access-token-value',
                'id_token' => $this->makeIdToken('test-nonce'),
            ]),
        ]);

        $this->hitCallback($config)->assertRedirect(route('dashboard'));

        $this->assertAuthenticated();
        Http::assertSentCount(4); // discovery, token, stale JWKS, refreshed JWKS
    }

    public function test_callback_redirects_to_safe_intended_url(): void
    {
        $config = $this->createOidcConfiguration();
        $this->fakeOidcProvider();

        $this->hitCallback($config, session: [...$this->oidcFlow($config), 'url.intended' => url('/profile')])
            ->assertRedirect(url('/profile'));
    }

    public function test_callback_ignores_external_intended_url(): void
    {
        $config = $this->createOidcConfiguration();
        $this->fakeOidcProvider();

        $this->hitCallback($config, session: [...$this->oidcFlow($config), 'url.intended' => 'https://evil.example.com/phish'])
            ->assertRedirect(route('dashboard'));

        $this->assertAuthenticated();
    }

    // ── Rejected callbacks ─────────────────────────────────────────────

    public function test_callback_rejects_bad_state(): void
    {
        $config = $this->createOidcConfiguration();
        $this->fakeOidcProvider();

        $this->hitCallback($config, ['state' => 'attacker-state'])
            ->assertRedirect(route('login'))
            ->assertSessionHas('error', fn ($m) => str_contains($m, 'invalid or has expired'));

        $this->assertGuest();
        Http::assertNothingSent();
    }

    public function test_callback_rejects_missing_session_flow(): void
    {
        $config = $this->createOidcConfiguration();
        $this->fakeOidcProvider();

        $this->hitCallback($config, session: [])->assertRedirect(route('login'));

        $this->assertGuest();
        Http::assertNothingSent();
    }

    public function test_callback_rejects_flow_started_for_another_configuration(): void
    {
        $config = $this->createOidcConfiguration();
        $other = $this->createOidcConfiguration(['name' => 'Other', 'issuer' => 'https://other.example.test']);
        $this->fakeOidcProvider();

        $this->hitCallback($config, session: $this->oidcFlow($other))->assertRedirect(route('login'));

        $this->assertGuest();
    }

    public function test_callback_rejects_expired_flow(): void
    {
        $config = $this->createOidcConfiguration();
        $flow = $this->oidcFlow($config);
        $flow['oidc_flow']['created_at'] = time() - 3600;
        $this->fakeOidcProvider();

        $this->hitCallback($config, session: $flow)->assertRedirect(route('login'));

        $this->assertGuest();
    }

    public function test_callback_surfaces_sanitised_idp_error(): void
    {
        $config = $this->createOidcConfiguration();
        $this->fakeOidcProvider();

        $this->hitCallback($config, ['code' => null, 'error' => 'access_denied<script>', 'error_description' => '<b>nope</b>'])
            ->assertRedirect(route('login'))
            ->assertSessionHas('error', 'Sign-in was not completed by the identity provider (access_deniedscript).');

        $this->assertGuest();
    }

    public function test_callback_rejects_bad_nonce(): void
    {
        $config = $this->createOidcConfiguration();
        $this->fakeOidcProvider(nonce: 'some-other-nonce');

        $this->hitCallback($config)
            ->assertRedirect(route('login'))
            ->assertSessionHas('error', fn ($m) => str_contains($m, 'nonce'));

        $this->assertGuest();
    }

    public function test_callback_rejects_wrong_audience(): void
    {
        $config = $this->createOidcConfiguration();
        $this->idTokenOverrides = ['aud' => 'some-other-client'];
        $this->fakeOidcProvider();

        $this->hitCallback($config)
            ->assertSessionHas('error', fn ($m) => str_contains($m, 'audience'));

        $this->assertGuest();
    }

    public function test_callback_rejects_multiple_audiences_without_matching_azp(): void
    {
        $config = $this->createOidcConfiguration();
        $this->idTokenOverrides = ['aud' => [$this->clientId, 'another-client'], 'azp' => 'another-client'];
        $this->fakeOidcProvider();

        $this->hitCallback($config)
            ->assertSessionHas('error', fn ($m) => str_contains($m, 'authorized party'));

        $this->assertGuest();
    }

    public function test_callback_rejects_wrong_issuer(): void
    {
        $config = $this->createOidcConfiguration();
        $this->idTokenOverrides = ['iss' => 'https://evil.example.test'];
        $this->fakeOidcProvider();

        $this->hitCallback($config)
            ->assertSessionHas('error', fn ($m) => str_contains($m, 'unexpected issuer'));

        $this->assertGuest();
    }

    public function test_callback_rejects_expired_id_token(): void
    {
        $config = $this->createOidcConfiguration();
        $this->idTokenOverrides = ['iat' => time() - 3600, 'exp' => time() - OidcService::LEEWAY_SECONDS - 5];
        $this->fakeOidcProvider();

        $this->hitCallback($config)
            ->assertSessionHas('error', fn ($m) => str_contains($m, 'expired'));

        $this->assertGuest();
    }

    public function test_callback_tolerates_small_clock_skew(): void
    {
        $config = $this->createOidcConfiguration();
        $this->idTokenOverrides = ['iat' => time() + 20, 'exp' => time() + 300];
        $this->fakeOidcProvider();

        $this->hitCallback($config)->assertRedirect(route('dashboard'));

        $this->assertAuthenticated();
    }

    public function test_callback_rejects_id_token_issued_in_the_future(): void
    {
        $config = $this->createOidcConfiguration();
        $this->idTokenOverrides = ['iat' => time() + 600, 'exp' => time() + 900];
        $this->fakeOidcProvider();

        $this->hitCallback($config)
            ->assertSessionHas('error', fn ($m) => str_contains($m, 'not valid yet'));

        $this->assertGuest();
    }

    public function test_callback_rejects_bad_signature(): void
    {
        $config = $this->createOidcConfiguration();
        // Same kid as the published key, signed by a different private key.
        $this->idTokenSigner = fn (array $claims) => JWT::encode($claims, $this->otherRsaKey()['private'], 'RS256', $this->kid);
        $this->fakeOidcProvider();

        $this->hitCallback($config)
            ->assertSessionHas('error', fn ($m) => str_contains($m, 'signature is invalid'));

        $this->assertGuest();
    }

    public function test_callback_rejects_tampered_claims(): void
    {
        $config = $this->createOidcConfiguration();
        $this->idTokenSigner = function (array $claims) {
            [$header, , $signature] = explode('.', JWT::encode($claims, $this->rsaKey()['private'], 'RS256', $this->kid));
            $forged = JWT::urlsafeB64Encode(json_encode([...$claims, 'sub' => 'admin']));

            return "{$header}.{$forged}.{$signature}";
        };
        $this->fakeOidcProvider();

        $this->hitCallback($config)->assertSessionHas('error', fn ($m) => str_contains($m, 'signature is invalid'));

        $this->assertGuest();
    }

    public function test_callback_rejects_alg_none(): void
    {
        $config = $this->createOidcConfiguration();
        $this->idTokenSigner = fn (array $claims) => JWT::urlsafeB64Encode(json_encode(['alg' => 'none', 'typ' => 'JWT', 'kid' => $this->kid]))
            .'.'.JWT::urlsafeB64Encode(json_encode($claims)).'.';
        $this->fakeOidcProvider();

        $this->hitCallback($config)
            ->assertSessionHas('error', fn ($m) => str_contains($m, 'algorithm that is not allowed'));

        $this->assertGuest();
    }

    public function test_callback_rejects_hs256_unless_explicitly_allowed(): void
    {
        $config = $this->createOidcConfiguration();
        // Classic key-confusion attempt: HMAC "signed" with public material.
        $this->idTokenSigner = fn (array $claims) => JWT::encode($claims, $this->clientSecret, 'HS256');
        $this->fakeOidcProvider();

        $this->hitCallback($config)
            ->assertSessionHas('error', fn ($m) => str_contains($m, 'algorithm that is not allowed'));

        $this->assertGuest();
    }

    public function test_hs256_works_when_explicitly_allowed(): void
    {
        $config = $this->createOidcConfiguration(['allowed_algorithms' => ['HS256']]);
        $this->idTokenSigner = fn (array $claims) => JWT::encode($claims, $this->clientSecret, 'HS256');
        $this->fakeOidcProvider();

        $this->hitCallback($config)->assertRedirect(route('dashboard'));

        $this->assertAuthenticated();
    }

    public function test_callback_rejects_rs256_when_only_es256_is_allowed(): void
    {
        $config = $this->createOidcConfiguration(['allowed_algorithms' => ['ES256']]);
        $this->fakeOidcProvider();

        $this->hitCallback($config)
            ->assertSessionHas('error', fn ($m) => str_contains($m, 'algorithm that is not allowed'));
    }

    public function test_callback_rejects_failed_token_exchange(): void
    {
        $config = $this->createOidcConfiguration();
        $discovery = $this->discoveryDocument();
        Http::fake([
            $this->issuer.'/.well-known/openid-configuration' => Http::response($discovery),
            $discovery['token_endpoint'] => Http::response(['error' => 'invalid_grant'], 400),
        ]);

        $this->hitCallback($config)
            ->assertSessionHas('error', fn ($m) => str_contains($m, 'rejected the authorization code'));

        $this->assertGuest();
    }

    // ── Account linking & user state ───────────────────────────────────

    public function test_unverified_email_does_not_take_over_existing_local_account(): void
    {
        $config = $this->createOidcConfiguration();
        $local = User::factory()->create(['email' => 'ada@example.com', 'auth_provider' => 'local']);
        $this->idTokenOverrides = ['email_verified' => false];
        $this->fakeOidcProvider();

        $this->hitCallback($config)
            ->assertRedirect(route('login'))
            ->assertSessionHas('error', fn ($m) => str_contains($m, 'has not verified the address'));

        $this->assertGuest();
        $local->refresh();
        $this->assertSame('local', $local->auth_provider);
        $this->assertNull($local->auth_provider_id);
    }

    public function test_missing_email_verified_claim_does_not_take_over_existing_account(): void
    {
        $config = $this->createOidcConfiguration();
        User::factory()->create(['email' => 'ada@example.com']);
        $this->idTokenOverrides = ['email_verified' => null];
        $this->fakeOidcProvider();

        $this->hitCallback($config)->assertRedirect(route('login'));

        $this->assertGuest();
    }

    public function test_verified_email_links_existing_local_account(): void
    {
        $config = $this->createOidcConfiguration();
        $local = User::factory()->create(['email' => 'ada@example.com', 'auth_provider' => 'local']);
        $this->fakeOidcProvider();

        $this->hitCallback($config)->assertRedirect(route('dashboard'));

        $this->assertAuthenticatedAs($local);
        $local->refresh();
        $this->assertSame('oidc', $local->auth_provider);
        $this->assertSame($this->providerUserId(), $local->auth_provider_id);
        $this->assertSame(1, User::count());
    }

    public function test_deactivated_linked_user_is_blocked(): void
    {
        $config = $this->createOidcConfiguration();
        $user = User::factory()->create([
            'name' => 'Before',
            'auth_provider' => 'oidc',
            'auth_provider_id' => $this->providerUserId(),
            'deactivated_at' => now(),
        ]);
        $this->fakeOidcProvider();

        $this->hitCallback($config)
            ->assertRedirect(route('login'))
            ->assertSessionHas('error', 'Your account has been deactivated.');

        $this->assertGuest();
        $this->assertSame('Before', $user->refresh()->name, 'Nothing is updated for deactivated users.');
    }

    public function test_deactivated_user_matched_by_email_is_blocked(): void
    {
        $config = $this->createOidcConfiguration();
        $user = User::factory()->create(['email' => 'ada@example.com', 'deactivated_at' => now()]);
        $this->fakeOidcProvider();

        $this->hitCallback($config)->assertSessionHas('error', 'Your account has been deactivated.');

        $this->assertGuest();
        $this->assertSame('local', $user->refresh()->auth_provider);
    }

    public function test_bot_accounts_cannot_be_claimed_via_sso(): void
    {
        $config = $this->createOidcConfiguration();
        User::factory()->create(['email' => 'ada@example.com', 'is_bot' => true]);
        $this->fakeOidcProvider();

        $this->hitCallback($config)->assertRedirect(route('login'));

        $this->assertGuest();
    }

    public function test_login_without_email_claim_is_rejected_for_new_users(): void
    {
        $config = $this->createOidcConfiguration();
        $this->idTokenOverrides = ['email' => null, 'email_verified' => null];
        $this->fakeOidcProvider();

        $this->hitCallback($config)
            ->assertSessionHas('error', fn ($m) => str_contains($m, 'did not share an email address'));

        $this->assertGuest();
        $this->assertSame(0, User::count());
    }

    // ── Logout ─────────────────────────────────────────────────────────

    public function test_logout_performs_rp_initiated_logout_when_enabled(): void
    {
        $config = $this->createOidcConfiguration(['end_session_enabled' => true]);
        $this->fakeOidcProvider();

        $this->hitCallback($config)->assertRedirect(route('dashboard'));
        $this->assertSame($config->id, session('oidc_logout.config_id'));

        $response = $this->withSession(['oidc_logout' => session('oidc_logout')])->post('/logout');

        $this->assertGuest();
        $location = $response->headers->get('Location');
        $this->assertStringStartsWith($this->issuer.'/protocol/openid-connect/logout?', $location);
        parse_str(parse_url($location, PHP_URL_QUERY), $query);
        $this->assertSame(SsoConfiguration::oidcPostLogoutRedirectUri(), $query['post_logout_redirect_uri']);
        $this->assertSame($this->clientId, $query['client_id']);
        $this->assertSame(3, count(explode('.', $query['id_token_hint'])));
    }

    public function test_logout_from_inertia_uses_external_location_header(): void
    {
        $config = $this->createOidcConfiguration(['end_session_enabled' => true]);
        $this->fakeOidcProvider();
        $user = User::factory()->create();

        $response = $this->actingAs($user)
            ->withSession(['oidc_logout' => ['config_id' => $config->id, 'id_token' => 'header.payload.sig']])
            ->withHeaders(['X-Inertia' => 'true'])
            ->post('/logout');

        $response->assertStatus(409);
        $this->assertStringStartsWith($this->issuer.'/protocol/openid-connect/logout?', $response->headers->get('X-Inertia-Location'));
    }

    public function test_logout_is_local_only_when_end_session_is_disabled(): void
    {
        $config = $this->createOidcConfiguration(['end_session_enabled' => false]);
        $this->fakeOidcProvider();
        $user = User::factory()->create();

        $this->actingAs($user)
            ->withSession(['oidc_logout' => ['config_id' => $config->id, 'id_token' => 'header.payload.sig']])
            ->post('/logout')
            ->assertRedirect('/');

        $this->assertGuest();
    }

    // ── Login page ─────────────────────────────────────────────────────

    public function test_login_page_lists_each_active_provider(): void
    {
        $oidc = $this->createOidcConfiguration(['button_label' => 'Acme Corp']);
        $this->createOidcConfiguration(['name' => 'Disabled', 'is_active' => false]);
        SsoConfiguration::create([
            'name' => 'Corporate SAML',
            'entity_id' => 'https://saml.example.test',
            'login_url' => 'https://saml.example.test/login',
            'certificate' => 'cert',
            'is_active' => true,
        ]);

        $this->get('/login')->assertInertia(fn ($page) => $page
            ->component('Auth/Login')
            ->where('ssoEnabled', true)
            ->has('ssoProviders', 2)
            ->where('ssoProviders.0.label', 'Acme Corp')
            ->where('ssoProviders.0.provider', 'oidc')
            ->where('ssoProviders.0.url', route('oidc.redirect', $oidc))
            ->where('ssoProviders.1.label', 'Corporate SAML')
            ->where('ssoProviders.1.url', route('saml.login')));
    }

    public function test_login_page_redirects_to_the_only_provider_when_local_auth_is_disabled(): void
    {
        $config = $this->createOidcConfiguration();
        AppSetting::set('local_auth_disabled', '1');

        $this->get('/login')->assertRedirect(route('oidc.redirect', $config));
    }

    public function test_login_page_shows_choices_when_local_auth_is_disabled_with_several_providers(): void
    {
        $this->createOidcConfiguration();
        $this->createOidcConfiguration(['name' => 'Second', 'issuer' => 'https://second.example.test']);
        AppSetting::set('local_auth_disabled', '1');

        $this->get('/login')->assertInertia(fn ($page) => $page
            ->where('localAuthEnabled', false)
            ->has('ssoProviders', 2));
    }

    public function test_saml_login_ignores_active_oidc_configurations(): void
    {
        $this->createOidcConfiguration();

        $this->get(route('saml.login'))
            ->assertRedirect(route('login'))
            ->assertSessionHas('error', 'SSO is not configured.');
    }
}
