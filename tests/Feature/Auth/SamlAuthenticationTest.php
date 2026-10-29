<?php

namespace Tests\Feature\Auth;

use App\Models\SsoConfiguration;
use App\Models\User;
use App\Services\SamlService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Mockery;
use Tests\TestCase;

class SamlAuthenticationTest extends TestCase
{
    use RefreshDatabase;

    public function test_saml_login_preserves_comma_delimited_display_name_for_new_users(): void
    {
        SsoConfiguration::create([
            'name' => 'Corporate SSO',
            'entity_id' => 'https://idp.example.com/metadata',
            'login_url' => 'https://idp.example.com/login',
            'certificate' => 'test-certificate',
            'attribute_mapping' => [
                'email' => 'email',
                'name' => 'displayName',
            ],
            'is_active' => true,
        ]);

        $this->mockSamlResponse([
            'name_id' => 'idp-123',
            'email' => 'dowilcox@example.com',
            'name' => 'Wilcox, Dow',
        ]);

        $response = $this->post(route('saml.acs'));

        $response->assertRedirect(route('dashboard', absolute: false));
        $this->assertAuthenticated();

        $user = User::where('email', 'dowilcox@example.com')->firstOrFail();

        $this->assertSame('Wilcox, Dow', $user->name);
        $this->assertSame('saml2', $user->auth_provider);
        $this->assertSame('idp-123', $user->auth_provider_id);
    }

    public function test_saml_login_updates_existing_user_name_without_stripping_commas(): void
    {
        SsoConfiguration::create([
            'name' => 'Corporate SSO',
            'entity_id' => 'https://idp.example.com/metadata',
            'login_url' => 'https://idp.example.com/login',
            'certificate' => 'test-certificate',
            'attribute_mapping' => [
                'email' => 'email',
                'name' => 'displayName',
            ],
            'is_active' => true,
        ]);

        User::factory()->create([
            'name' => 'Dow Wilcox',
            'email' => 'dowilcox@example.com',
            'auth_provider' => 'saml2',
            'auth_provider_id' => 'idp-123',
        ]);

        $this->mockSamlResponse([
            'name_id' => 'idp-123',
            'email' => 'dowilcox@example.com',
            'name' => 'Wilcox, Dow',
        ]);

        $response = $this->post(route('saml.acs'));

        $response->assertRedirect(route('dashboard', absolute: false));
        $this->assertAuthenticated();

        $user = User::where('email', 'dowilcox@example.com')->firstOrFail();

        $this->assertSame('Wilcox, Dow', $user->name);
    }

    public function test_saml_login_updates_email_matched_user_name_when_auto_linking(): void
    {
        SsoConfiguration::create([
            'name' => 'Corporate SSO',
            'entity_id' => 'https://idp.example.com/metadata',
            'login_url' => 'https://idp.example.com/login',
            'certificate' => 'test-certificate',
            'attribute_mapping' => [
                'email' => 'email',
                'name' => 'displayName',
            ],
            'is_active' => true,
        ]);

        User::factory()->create([
            'name' => 'Dow Wilcox',
            'email' => 'dowilcox@example.com',
            'auth_provider' => 'local',
            'auth_provider_id' => null,
        ]);

        $this->mockSamlResponse([
            'name_id' => 'idp-123',
            'email' => 'dowilcox@example.com',
            'name' => 'Wilcox, Dow',
        ]);

        $response = $this->post(route('saml.acs'));

        $response->assertRedirect(route('dashboard', absolute: false));
        $this->assertAuthenticated();

        $user = User::where('email', 'dowilcox@example.com')->firstOrFail();

        $this->assertSame('Wilcox, Dow', $user->name);
        $this->assertSame('saml2', $user->auth_provider);
        $this->assertSame('idp-123', $user->auth_provider_id);
    }

    public function test_saml_login_rejects_deactivated_user_without_modifying_account(): void
    {
        $this->createActiveConfig();

        $user = User::factory()->create([
            'name' => 'Dow Wilcox',
            'email' => 'dowilcox@example.com',
            'auth_provider' => 'local',
            'auth_provider_id' => null,
            'deactivated_at' => now(),
        ]);

        $this->mockSamlResponse([
            'name_id' => 'idp-123',
            'email' => 'dowilcox@example.com',
            'name' => 'Someone Else',
        ]);

        $this->post(route('saml.acs'))->assertRedirect(route('login'));

        $this->assertGuest();
        $user->refresh();
        $this->assertSame('Dow Wilcox', $user->name);
        $this->assertSame('local', $user->auth_provider);
        $this->assertNull($user->auth_provider_id);
    }

    public function test_saml_login_rejects_bot_account_with_matching_email(): void
    {
        $this->createActiveConfig();

        $bot = User::factory()->create([
            'name' => 'CI Bot',
            'email' => 'bot@example.com',
            'is_bot' => true,
        ]);

        $this->mockSamlResponse([
            'name_id' => 'idp-bot',
            'email' => 'bot@example.com',
            'name' => 'Attacker',
        ]);

        $this->post(route('saml.acs'))->assertRedirect(route('login'));

        $this->assertGuest();
        $this->assertSame('CI Bot', $bot->refresh()->name);
        $this->assertNotSame('saml2', $bot->auth_provider);
    }

    public function test_saml_login_keeps_email_when_asserted_email_belongs_to_another_account(): void
    {
        $this->createActiveConfig();

        $samlUser = User::factory()->create([
            'email' => 'old@example.com',
            'auth_provider' => 'saml2',
            'auth_provider_id' => 'idp-123',
        ]);
        User::factory()->create(['email' => 'taken@example.com']);

        $this->mockSamlResponse([
            'name_id' => 'idp-123',
            'email' => 'taken@example.com',
            'name' => 'Dow Wilcox',
        ]);

        $this->post(route('saml.acs'))->assertRedirect(route('dashboard', absolute: false));

        $this->assertAuthenticatedAs($samlUser);
        $this->assertSame('old@example.com', $samlUser->refresh()->email);
        $this->assertSame('Dow Wilcox', $samlUser->name);
    }

    private function createActiveConfig(): void
    {
        SsoConfiguration::create([
            'name' => 'Corporate SSO',
            'entity_id' => 'https://idp.example.com/metadata',
            'login_url' => 'https://idp.example.com/login',
            'certificate' => 'test-certificate',
            'attribute_mapping' => [
                'email' => 'email',
                'name' => 'displayName',
            ],
            'is_active' => true,
        ]);
    }

    private function mockSamlResponse(array $payload): void
    {
        $mock = Mockery::mock(SamlService::class);
        $mock->shouldReceive('processResponse')
            ->once()
            ->andReturn($payload);

        $this->app->instance(SamlService::class, $mock);
    }
}
