<?php

namespace Tests\Unit;

use App\Models\SsoConfiguration;
use App\Services\SamlService;
use Mockery;
use OneLogin\Saml2\Auth as SamlAuth;
use Tests\TestCase;

class SamlServiceTest extends TestCase
{
    public function test_process_response_uses_friendly_name_attribute_mapping(): void
    {
        $service = $this->serviceWithAuth($this->mockSamlAuth(
            attributes: [
                'urn:oid:0.9.2342.19200300.100.1.3' => ['dowilcox@example.com'],
            ],
            friendlyAttributes: [
                'displayName' => ['Wilcox, Donald'],
            ],
            nameId: 'Wilcox',
        ));

        $result = $service->processResponse(new SsoConfiguration([
            'name' => 'Corporate SSO',
            'attribute_mapping' => [
                'email' => 'urn:oid:0.9.2342.19200300.100.1.3',
                'name' => 'displayName',
            ],
        ]));

        $this->assertSame('dowilcox@example.com', $result['email']);
        $this->assertSame('Wilcox, Donald', $result['name']);
    }

    public function test_process_response_joins_multi_value_display_name_attributes(): void
    {
        $service = $this->serviceWithAuth($this->mockSamlAuth(
            attributes: [
                'email' => ['dowilcox@example.com'],
                'displayName' => ['Wilcox', 'Donald'],
            ],
            friendlyAttributes: [],
            nameId: 'Wilcox',
        ));

        $result = $service->processResponse(new SsoConfiguration([
            'name' => 'Corporate SSO',
            'attribute_mapping' => [
                'email' => 'email',
                'name' => 'displayName',
            ],
        ]));

        $this->assertSame('dowilcox@example.com', $result['email']);
        $this->assertSame('Wilcox, Donald', $result['name']);
    }

    private function mockSamlAuth(array $attributes, array $friendlyAttributes, string $nameId): SamlAuth
    {
        $auth = Mockery::mock(SamlAuth::class);
        $auth->shouldReceive('processResponse')->once();
        $auth->shouldReceive('getErrors')->once()->andReturn([]);
        $auth->shouldReceive('isAuthenticated')->once()->andReturnTrue();
        $auth->shouldReceive('getAttributes')->once()->andReturn($attributes);
        $auth->shouldReceive('getAttributesWithFriendlyName')->once()->andReturn($friendlyAttributes);
        $auth->shouldReceive('getNameId')->once()->andReturn($nameId);

        return $auth;
    }

    private function serviceWithAuth(SamlAuth $auth): SamlService
    {
        return new class($auth) extends SamlService
        {
            public function __construct(private SamlAuth $auth) {}

            public function createAuth(SsoConfiguration $config): SamlAuth
            {
                return $this->auth;
            }
        };
    }
}
