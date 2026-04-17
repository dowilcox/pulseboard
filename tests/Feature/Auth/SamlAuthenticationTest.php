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

    private function mockSamlResponse(array $payload): void
    {
        $mock = Mockery::mock(SamlService::class);
        $mock->shouldReceive('processResponse')
            ->once()
            ->andReturn($payload);

        $this->app->instance(SamlService::class, $mock);
    }
}
