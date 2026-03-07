<?php

namespace Tests\Feature\Api\V1;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class TokenApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_list_tokens(): void
    {
        $user = User::factory()->create();
        $user->createToken('token-1', ['read']);
        $user->createToken('token-2', ['read', 'write']);
        $token = $user->createToken('active', ['read'])->plainTextToken;

        $response = $this->withHeader('Authorization', "Bearer $token")
            ->getJson('/api/v1/tokens');

        $response->assertOk();
        $response->assertJsonCount(3, 'data');
    }

    public function test_create_token(): void
    {
        $user = User::factory()->create();
        $token = $user->createToken('bootstrap', ['read', 'write'])->plainTextToken;

        $response = $this->withHeader('Authorization', "Bearer $token")
            ->postJson('/api/v1/tokens', [
                'name' => 'new-token',
                'abilities' => ['read', 'write'],
            ]);

        $response->assertCreated();
        $response->assertJsonStructure(['data' => ['id', 'name', 'abilities', 'plain_text_token']]);
        $response->assertJsonPath('data.name', 'new-token');
    }

    public function test_revoke_token(): void
    {
        $user = User::factory()->create();
        $toRevoke = $user->createToken('revoke-me', ['read']);
        $active = $user->createToken('active', ['read'])->plainTextToken;

        $response = $this->withHeader('Authorization', "Bearer $active")
            ->deleteJson("/api/v1/tokens/{$toRevoke->accessToken->id}");

        $response->assertNoContent();
        $this->assertDatabaseMissing('personal_access_tokens', ['id' => $toRevoke->accessToken->id]);
    }
}
