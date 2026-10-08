<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\PersonalAccessToken;
use Tests\TestCase;

class ProfileTokenControllerTest extends TestCase
{
    use RefreshDatabase;

    public function test_user_can_create_a_read_only_token(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user)
            ->from(route('profile.edit'))
            ->post(route('profile.tokens.store'), [
                'name' => 'CLI',
                'abilities' => ['read'],
            ]);

        $response->assertRedirect(route('profile.edit'));
        $response->assertSessionHas('success');
        $response->assertSessionHas('token');

        $token = $user->tokens()->sole();
        $this->assertSame('CLI', $token->name);
        $this->assertSame(['read'], $token->abilities);

        // The flashed plaintext token authenticates as this token.
        [$id] = explode('|', session('token'), 2);
        $this->assertSame((string) $token->id, $id);
    }

    public function test_write_tokens_always_include_read(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)
            ->post(route('profile.tokens.store'), [
                'name' => 'Automation',
                'abilities' => ['write'],
            ])
            ->assertSessionHasNoErrors();

        $this->assertSame(['read', 'write'], $user->tokens()->sole()->abilities);
    }

    public function test_token_creation_is_validated(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)
            ->post(route('profile.tokens.store'), [
                'name' => '',
                'abilities' => ['manage'],
            ])
            ->assertSessionHasErrors(['name', 'abilities.0']);

        $this->assertSame(0, $user->tokens()->count());
    }

    public function test_index_lists_only_the_users_own_tokens(): void
    {
        $user = User::factory()->create();
        $other = User::factory()->create();
        $user->createToken('Mine', ['read']);
        $other->createToken('Theirs', ['read', 'write']);

        $this->actingAs($user)
            ->getJson(route('profile.tokens.index'))
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.name', 'Mine')
            ->assertJsonPath('data.0.abilities', ['read'])
            ->assertJsonPath('data.0.last_used_at', null)
            ->assertJsonStructure(['data' => [['id', 'name', 'abilities', 'last_used_at', 'created_at']]]);
    }

    public function test_user_can_revoke_their_own_token(): void
    {
        $user = User::factory()->create();
        $token = $user->createToken('Old', ['read'])->accessToken;

        $this->actingAs($user)
            ->from(route('profile.edit'))
            ->delete(route('profile.tokens.destroy', $token->id))
            ->assertRedirect(route('profile.edit'))
            ->assertSessionHas('success');

        $this->assertNull(PersonalAccessToken::find($token->id));
    }

    public function test_user_cannot_revoke_someone_elses_token(): void
    {
        $user = User::factory()->create();
        $other = User::factory()->create();
        $token = $other->createToken('Theirs', ['read'])->accessToken;

        $this->actingAs($user)
            ->delete(route('profile.tokens.destroy', $token->id))
            ->assertNotFound();

        $this->assertNotNull(PersonalAccessToken::find($token->id));
    }

    public function test_guests_cannot_manage_tokens(): void
    {
        $this->getJson(route('profile.tokens.index'))->assertUnauthorized();
        $this->post(route('profile.tokens.store'), ['name' => 'x'])
            ->assertRedirect(route('login'));
    }
}
