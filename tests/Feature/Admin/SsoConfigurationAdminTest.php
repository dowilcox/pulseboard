<?php

namespace Tests\Feature\Admin;

use App\Models\SsoConfiguration;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Tests\Concerns\FakesOidcProvider;
use Tests\TestCase;

class SsoConfigurationAdminTest extends TestCase
{
    use FakesOidcProvider, RefreshDatabase;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();

        // Full-page Inertia renders need no built assets here.
        $this->withoutVite();

        $this->admin = User::factory()->create(['is_admin' => true]);
    }

    private function oidcPayload(array $overrides = []): array
    {
        return [
            'provider' => 'oidc',
            'name' => 'Keycloak',
            'button_label' => 'Acme Keycloak',
            'issuer' => $this->issuer,
            'client_id' => $this->clientId,
            'client_secret' => $this->clientSecret,
            'scopes' => 'openid email profile',
            'attribute_mapping' => ['email' => 'email', 'name' => 'name'],
            'allowed_algorithms' => [],
            'fetch_userinfo' => true,
            'end_session_enabled' => false,
            'is_active' => true,
            ...$overrides,
        ];
    }

    private function samlPayload(array $overrides = []): array
    {
        return [
            'name' => 'Corporate SAML',
            'entity_id' => 'https://saml.example.test/metadata',
            'login_url' => 'https://saml.example.test/login',
            'certificate' => 'MIIC-test-certificate',
            'attribute_mapping' => ['email' => 'email', 'name' => 'displayName'],
            'is_active' => true,
            ...$overrides,
        ];
    }

    public function test_non_admins_cannot_manage_sso(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)->get(route('admin.sso.index'))->assertForbidden();
        $this->actingAs($user)->post(route('admin.sso.store'), $this->oidcPayload())->assertForbidden();
        $this->assertSame(0, SsoConfiguration::count());
    }

    public function test_admin_can_create_oidc_provider(): void
    {
        $id = (string) Str::uuid7();

        $this->actingAs($this->admin)
            ->post(route('admin.sso.store'), $this->oidcPayload([
                'id' => $id,
                'scopes' => 'email, profile groups',
                'allowed_algorithms' => ['RS256', 'ES256'],
            ]))
            ->assertRedirect(route('admin.sso.index'))
            ->assertSessionHasNoErrors();

        $config = SsoConfiguration::findOrFail($id);
        $this->assertSame('oidc', $config->provider);
        $this->assertSame($this->issuer, $config->issuer);
        $this->assertSame('Acme Keycloak', $config->button_label);
        $this->assertSame('openid email profile groups', $config->scopes);
        $this->assertSame(['RS256', 'ES256'], $config->allowed_algorithms);
        $this->assertTrue($config->fetch_userinfo);
        $this->assertNull($config->entity_id);
        $this->assertNull($config->certificate);
        $this->assertSame(url('/auth/oidc/'.$id.'/callback'), $config->oidcRedirectUri());
    }

    public function test_client_secret_is_encrypted_at_rest(): void
    {
        $this->actingAs($this->admin)->post(route('admin.sso.store'), $this->oidcPayload());

        $raw = DB::table('sso_configurations')->value('client_secret');

        $this->assertNotSame($this->clientSecret, $raw);
        $this->assertStringNotContainsString($this->clientSecret, $raw);
        $this->assertSame($this->clientSecret, Crypt::decryptString($raw));
        $this->assertSame($this->clientSecret, SsoConfiguration::first()->client_secret);
    }

    public function test_secrets_are_never_sent_to_the_frontend(): void
    {
        $this->createOidcConfiguration();
        SsoConfiguration::create($this->samlPayload(['is_active' => false]));

        $response = $this->actingAs($this->admin)->get(route('admin.sso.index'));

        $response->assertInertia(fn ($page) => $page
            ->component('Admin/SsoConfiguration')
            ->has('configurations', 2)
            ->where('configurations.0.provider', 'oidc')
            ->where('configurations.0.has_client_secret', true)
            ->missing('configurations.0.client_secret')
            ->where('configurations.0.redirect_uri', fn ($uri) => str_ends_with($uri, '/callback'))
            ->where('configurations.1.provider', 'saml2')
            ->where('configurations.1.has_certificate', true)
            ->missing('configurations.1.certificate')
            ->has('newConfigurationId')
            ->where('oidcRedirectUriTemplate', fn ($uri) => str_contains($uri, '/auth/oidc/{id}/callback')));

        $this->assertStringNotContainsString($this->clientSecret, $response->getContent());
        $this->assertStringNotContainsString('MIIC-test-certificate', $response->getContent());
        $this->assertArrayNotHasKey('client_secret', SsoConfiguration::first()->toArray());
    }

    public function test_oidc_validation_requires_issuer_client_id_and_secret(): void
    {
        $this->actingAs($this->admin)
            ->post(route('admin.sso.store'), $this->oidcPayload([
                'issuer' => '',
                'client_id' => '',
                'client_secret' => '',
            ]))
            ->assertSessionHasErrors(['issuer', 'client_id', 'client_secret'])
            ->assertSessionDoesntHaveErrors(['entity_id', 'login_url', 'certificate']);

        $this->assertSame(0, SsoConfiguration::count());
    }

    public function test_oidc_validation_rejects_bad_values(): void
    {
        $this->actingAs($this->admin)
            ->post(route('admin.sso.store'), $this->oidcPayload([
                'issuer' => 'http://insecure.example.test',
                'allowed_algorithms' => ['none'],
                'scopes' => "openid profil\u{00E9}",
                'id' => 'not-a-uuid',
            ]))
            ->assertSessionHasErrors(['issuer', 'allowed_algorithms.0', 'scopes', 'id']);

        $this->actingAs($this->admin)
            ->post(route('admin.sso.store'), $this->oidcPayload(['provider' => 'ldap']))
            ->assertSessionHasErrors(['provider']);
    }

    public function test_saml_validation_still_requires_saml_fields(): void
    {
        $this->actingAs($this->admin)
            ->post(route('admin.sso.store'), ['name' => 'SAML', 'is_active' => false])
            ->assertSessionHasErrors(['entity_id', 'login_url', 'certificate'])
            ->assertSessionDoesntHaveErrors(['issuer', 'client_id', 'client_secret']);
    }

    public function test_admin_can_create_saml_provider_without_provider_field(): void
    {
        $this->actingAs($this->admin)
            ->post(route('admin.sso.store'), [
                ...$this->samlPayload(),
                // OIDC fields sent by the shared form are ignored for SAML.
                'issuer' => 'https://ignored.example.test',
                'client_secret' => 'ignored',
            ])
            ->assertSessionHasNoErrors();

        $config = SsoConfiguration::firstOrFail();
        $this->assertSame('saml2', $config->provider);
        $this->assertSame('MIIC-test-certificate', $config->certificate);
        $this->assertNull($config->issuer);
        $this->assertNull($config->client_secret);
    }

    public function test_only_one_saml_provider_may_be_active_but_oidc_may_coexist(): void
    {
        $first = SsoConfiguration::create($this->samlPayload());
        $this->createOidcConfiguration();

        $this->actingAs($this->admin)
            ->post(route('admin.sso.store'), $this->samlPayload(['name' => 'Second SAML']))
            ->assertSessionHasErrors(['is_active']);

        $this->actingAs($this->admin)
            ->post(route('admin.sso.store'), $this->samlPayload(['name' => 'Second SAML', 'is_active' => false]))
            ->assertSessionHasNoErrors();

        // Updating the already-active SAML provider is fine.
        $this->actingAs($this->admin)
            ->put(route('admin.sso.update', $first), $this->samlPayload(['certificate' => '']))
            ->assertSessionHasNoErrors();

        // A second active OIDC provider is allowed.
        $this->actingAs($this->admin)
            ->post(route('admin.sso.store'), $this->oidcPayload(['name' => 'Second OIDC', 'issuer' => 'https://second.example.test']))
            ->assertSessionHasNoErrors();

        $this->assertSame(3, SsoConfiguration::active()->count());
    }

    public function test_update_keeps_secrets_when_left_blank(): void
    {
        $config = $this->createOidcConfiguration();

        $this->actingAs($this->admin)
            ->put(route('admin.sso.update', $config), $this->oidcPayload([
                'name' => 'Renamed',
                'client_secret' => '',
                // Provider type can't be switched on update.
                'provider' => 'saml2',
            ]))
            ->assertSessionHasNoErrors();

        $config->refresh();
        $this->assertSame('Renamed', $config->name);
        $this->assertSame('oidc', $config->provider);
        $this->assertSame($this->clientSecret, $config->client_secret);

        $this->actingAs($this->admin)
            ->put(route('admin.sso.update', $config), $this->oidcPayload(['client_secret' => 'a-brand-new-secret']))
            ->assertSessionHasNoErrors();

        $this->assertSame('a-brand-new-secret', $config->refresh()->client_secret);
    }

    public function test_update_validates_against_the_stored_provider(): void
    {
        $config = $this->createOidcConfiguration();

        $this->actingAs($this->admin)
            ->put(route('admin.sso.update', $config), $this->oidcPayload(['issuer' => '', 'client_secret' => '']))
            ->assertSessionHasErrors(['issuer'])
            ->assertSessionDoesntHaveErrors(['client_secret', 'entity_id']);
    }

    public function test_saml_update_keeps_certificate_when_blank(): void
    {
        $config = SsoConfiguration::create($this->samlPayload());

        $this->actingAs($this->admin)
            ->put(route('admin.sso.update', $config), $this->samlPayload(['name' => 'Renamed SAML', 'certificate' => '']))
            ->assertSessionHasNoErrors();

        $config->refresh();
        $this->assertSame('Renamed SAML', $config->name);
        $this->assertSame('MIIC-test-certificate', $config->certificate);
    }

    public function test_admin_can_delete_provider(): void
    {
        $config = $this->createOidcConfiguration();

        $this->actingAs($this->admin)
            ->delete(route('admin.sso.destroy', $config))
            ->assertRedirect(route('admin.sso.index'));

        $this->assertSame(0, SsoConfiguration::count());
    }

    public function test_connection_test_validates_discovery_and_jwks(): void
    {
        $config = $this->createOidcConfiguration(['end_session_enabled' => true]);
        $this->fakeOidcProvider();

        $this->actingAs($this->admin)
            ->postJson(route('admin.sso.test', $config))
            ->assertOk()
            ->assertJson(['success' => true])
            ->assertJsonFragment(['label' => 'Signing keys (JWKS)', 'ok' => true]);
    }

    public function test_connection_test_reports_issuer_mismatch(): void
    {
        $config = $this->createOidcConfiguration();
        $this->discoveryOverrides = ['issuer' => 'https://someone-else.example.test'];
        $this->fakeOidcProvider();

        $this->actingAs($this->admin)
            ->postJson(route('admin.sso.test', $config))
            ->assertStatus(422)
            ->assertJson(['success' => false])
            ->assertJsonPath('message', fn ($message) => str_contains($message, 'Issuer mismatch'));
    }

    public function test_connection_test_reports_missing_end_session_endpoint(): void
    {
        $config = $this->createOidcConfiguration(['end_session_enabled' => true]);
        $this->discoveryOverrides = ['end_session_endpoint' => null];
        $this->fakeOidcProvider();

        $this->actingAs($this->admin)
            ->postJson(route('admin.sso.test', $config))
            ->assertStatus(422)
            ->assertJsonPath('message', fn ($message) => str_contains($message, 'end_session_endpoint'));
    }

    public function test_connection_test_bypasses_the_discovery_cache(): void
    {
        $config = $this->createOidcConfiguration();
        Http::fake([
            $this->issuer.'/.well-known/openid-configuration' => Http::sequence()
                ->push($this->discoveryDocument())
                ->push([...$this->discoveryDocument(), 'issuer' => 'https://changed.example.test']),
            '*' => Http::response($this->jwks()),
        ]);

        // First test caches a good document; the second must refetch and
        // notice the provider changed underneath us.
        $this->actingAs($this->admin)->postJson(route('admin.sso.test', $config))->assertOk();
        $this->actingAs($this->admin)->postJson(route('admin.sso.test', $config))->assertStatus(422);
    }

    public function test_saml_connection_test_still_works(): void
    {
        $config = SsoConfiguration::create($this->samlPayload());

        $this->actingAs($this->admin)
            ->postJson(route('admin.sso.test', $config))
            ->assertJsonStructure(['success', 'message']);
    }
}
