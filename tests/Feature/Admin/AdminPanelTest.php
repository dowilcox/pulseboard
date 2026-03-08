<?php

namespace Tests\Feature\Admin;

use App\Models\Team;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Password;
use Tests\TestCase;

class AdminPanelTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    private User $regularUser;

    protected function setUp(): void
    {
        parent::setUp();

        $this->admin = User::factory()->create(['is_admin' => true]);
        $this->regularUser = User::factory()->create(['is_admin' => false]);
    }

    // ── Admin Access ────────────────────────────────────────────────────

    public function test_non_admin_cannot_access_admin_dashboard(): void
    {
        $response = $this->actingAs($this->regularUser)
            ->get(route('admin.dashboard'));

        $response->assertForbidden();
    }

    public function test_admin_can_access_dashboard(): void
    {
        $response = $this->actingAs($this->admin)
            ->get(route('admin.dashboard'));

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->component('Admin/Dashboard')
            ->has('stats')
        );
    }

    // ── Admin UserController ────────────────────────────────────────────

    public function test_admin_can_list_users(): void
    {
        $response = $this->actingAs($this->admin)
            ->get(route('admin.users.index'));

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->component('Admin/Users')
            ->has('users')
        );
    }

    public function test_admin_can_create_user(): void
    {
        $response = $this->actingAs($this->admin)
            ->post(route('admin.users.store'), [
                'name' => 'New User',
                'email' => 'newuser@example.com',
                'password' => 'SecurePass123!',
                'is_admin' => false,
            ]);

        $response->assertRedirect(route('admin.users.index'));
        $this->assertDatabaseHas('users', [
            'name' => 'New User',
            'email' => 'newuser@example.com',
            'is_admin' => false,
        ]);
    }

    public function test_admin_can_update_user(): void
    {
        $user = User::factory()->create([
            'name' => 'Old Name',
            'email' => 'old@example.com',
        ]);

        $response = $this->actingAs($this->admin)
            ->put(route('admin.users.update', $user), [
                'name' => 'Updated Name',
                'email' => 'updated@example.com',
                'is_admin' => true,
            ]);

        $response->assertRedirect(route('admin.users.index'));
        $user->refresh();
        $this->assertEquals('Updated Name', $user->name);
        $this->assertEquals('updated@example.com', $user->email);
        $this->assertTrue($user->is_admin);
    }

    public function test_admin_can_toggle_user_active(): void
    {
        $user = User::factory()->create(['deactivated_at' => null]);

        // Deactivate
        $response = $this->actingAs($this->admin)
            ->post(route('admin.users.toggle-active', $user));

        $response->assertRedirect(route('admin.users.index'));
        $user->refresh();
        $this->assertNotNull($user->deactivated_at);

        // Reactivate
        $response = $this->actingAs($this->admin)
            ->post(route('admin.users.toggle-active', $user));

        $response->assertRedirect(route('admin.users.index'));
        $user->refresh();
        $this->assertNull($user->deactivated_at);
    }

    public function test_admin_can_reset_user_password(): void
    {
        Password::shouldReceive('sendResetLink')
            ->once()
            ->with(['email' => $this->regularUser->email])
            ->andReturn(Password::RESET_LINK_SENT);

        $response = $this->actingAs($this->admin)
            ->post(route('admin.users.reset-password', $this->regularUser));

        $response->assertRedirect(route('admin.users.index'));
    }

    // ── Admin TeamController ────────────────────────────────────────────

    public function test_admin_can_list_teams(): void
    {
        Team::factory()->count(3)->create();

        $response = $this->actingAs($this->admin)
            ->get(route('admin.teams.index'));

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->component('Admin/Teams')
            ->has('adminTeams', 3)
        );
    }

    // ── Admin ApiTokenController ────────────────────────────────────────

    public function test_admin_can_view_api_tokens(): void
    {
        $response = $this->actingAs($this->admin)
            ->get(route('admin.api-tokens.index'));

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->component('Admin/ApiTokens')
            ->has('users')
        );
    }

    public function test_admin_can_create_token_for_user(): void
    {
        $response = $this->actingAs($this->admin)
            ->post(route('admin.api-tokens.create-token', $this->regularUser), [
                'name' => 'Test Token',
                'abilities' => ['read', 'write'],
            ]);

        $response->assertRedirect();
        $response->assertSessionHas('success');
        $this->assertCount(1, $this->regularUser->fresh()->tokens);
    }

    public function test_admin_can_revoke_token(): void
    {
        $token = $this->regularUser->createToken('Disposable Token', ['read']);
        $tokenId = $token->accessToken->id;

        $response = $this->actingAs($this->admin)
            ->delete(route('admin.api-tokens.revoke-token', [
                'user' => $this->regularUser,
                'tokenId' => $tokenId,
            ]));

        $response->assertRedirect();
        $response->assertSessionHas('success');
        $this->assertCount(0, $this->regularUser->fresh()->tokens);
    }
}
