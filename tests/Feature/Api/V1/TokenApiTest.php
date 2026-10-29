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

    public function test_read_token_cannot_create_write_or_manage_token(): void
    {
        $user = User::factory()->create();
        $token = $user->createToken('reader', ['read'])->plainTextToken;

        foreach ([['write'], ['read', 'write'], ['manage'], ['read', 'manage']] as $abilities) {
            $this->withHeader('Authorization', "Bearer $token")
                ->postJson('/api/v1/tokens', ['name' => 'escalated', 'abilities' => $abilities])
                ->assertForbidden();
        }

        $this->assertDatabaseMissing('personal_access_tokens', ['name' => 'escalated']);
    }

    public function test_read_token_can_create_read_token(): void
    {
        $user = User::factory()->create();
        $token = $user->createToken('reader', ['read'])->plainTextToken;

        $this->withHeader('Authorization', "Bearer $token")
            ->postJson('/api/v1/tokens', ['name' => 'another-reader'])
            ->assertCreated()
            ->assertJsonPath('data.abilities', ['read']);
    }

    public function test_write_token_can_create_read_write_but_not_manage_token(): void
    {
        $user = User::factory()->create();
        $token = $user->createToken('writer', ['read', 'write'])->plainTextToken;

        $this->withHeader('Authorization', "Bearer $token")
            ->postJson('/api/v1/tokens', ['name' => 'rw', 'abilities' => ['read', 'write']])
            ->assertCreated()
            ->assertJsonPath('data.abilities', ['read', 'write']);

        $this->withHeader('Authorization', "Bearer $token")
            ->postJson('/api/v1/tokens', ['name' => 'admin', 'abilities' => ['read', 'write', 'manage']])
            ->assertForbidden();

        $this->assertDatabaseMissing('personal_access_tokens', ['name' => 'admin']);
    }

    public function test_wildcard_token_can_create_any_token(): void
    {
        $user = User::factory()->create();
        $token = $user->createToken('legacy')->plainTextToken; // abilities ["*"]

        $this->withHeader('Authorization', "Bearer $token")
            ->postJson('/api/v1/tokens', ['name' => 'full', 'abilities' => ['read', 'write', 'manage']])
            ->assertCreated();
    }

    public function test_session_user_can_create_any_token(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)
            ->postJson('/api/v1/tokens', ['name' => 'full', 'abilities' => ['read', 'write', 'manage']])
            ->assertCreated()
            ->assertJsonPath('data.abilities', ['read', 'write', 'manage']);
    }

    public function test_token_cannot_revoke_a_more_powerful_token(): void
    {
        $user = User::factory()->create();
        $powerful = $user->createToken('powerful', ['read', 'write', 'manage']);
        $reader = $user->createToken('reader', ['read'])->plainTextToken;

        $this->withHeader('Authorization', "Bearer $reader")
            ->deleteJson("/api/v1/tokens/{$powerful->accessToken->id}")
            ->assertForbidden();

        $this->assertDatabaseHas('personal_access_tokens', ['id' => $powerful->accessToken->id]);
    }

    public function test_token_can_always_revoke_itself(): void
    {
        $user = User::factory()->create();
        $reader = $user->createToken('reader', []);

        $this->withHeader('Authorization', "Bearer {$reader->plainTextToken}")
            ->deleteJson("/api/v1/tokens/{$reader->accessToken->id}")
            ->assertNoContent();

        $this->assertDatabaseMissing('personal_access_tokens', ['id' => $reader->accessToken->id]);
    }

    public function test_cannot_revoke_another_users_token(): void
    {
        $user = User::factory()->create();
        $other = User::factory()->create()->createToken('theirs', ['read']);
        $token = $user->createToken('mine', ['read', 'write', 'manage'])->plainTextToken;

        $this->withHeader('Authorization', "Bearer $token")
            ->deleteJson("/api/v1/tokens/{$other->accessToken->id}")
            ->assertNotFound();
    }
}
