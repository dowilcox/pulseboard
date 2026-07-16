<?php

namespace Tests\Feature\Api\V1;

use App\Models\Team;
use App\Models\TeamMember;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class TeamManagementApiTest extends TestCase
{
    use RefreshDatabase;

    private User $owner;

    private Team $team;

    private string $ownerToken;

    protected function setUp(): void
    {
        parent::setUp();

        $this->owner = User::factory()->create();
        $this->team = Team::factory()->create();
        TeamMember::create(['team_id' => $this->team->id, 'user_id' => $this->owner->id, 'role' => 'owner']);
        $this->ownerToken = $this->owner->createToken('test', ['read', 'write', 'manage'])->plainTextToken;
    }

    private function api(?string $token = null): static
    {
        return $this->withHeader('Authorization', 'Bearer '.($token ?? $this->ownerToken));
    }

    private function tokenFor(User $user, array $abilities = ['read', 'write', 'manage']): string
    {
        return $user->createToken('test', $abilities)->plainTextToken;
    }

    private function addMember(string $role = 'member'): User
    {
        $user = User::factory()->create();
        TeamMember::create(['team_id' => $this->team->id, 'user_id' => $user->id, 'role' => $role]);

        return $user;
    }

    // ---- Teams ----

    public function test_create_team(): void
    {
        $response = $this->api()->postJson('/api/v1/teams', [
            'name' => 'API Team',
            'description' => 'Created via API',
        ]);

        $response->assertCreated();
        $response->assertJsonPath('data.name', 'API Team');
        $this->assertDatabaseHas('teams', ['name' => 'API Team']);

        $teamId = $response->json('data.id');
        $this->assertDatabaseHas('team_members', [
            'team_id' => $teamId,
            'user_id' => $this->owner->id,
            'role' => 'owner',
        ]);
    }

    public function test_create_team_requires_manage_ability(): void
    {
        $token = $this->tokenFor($this->owner, ['read', 'write']);

        $this->api($token)
            ->postJson('/api/v1/teams', ['name' => 'Nope'])
            ->assertForbidden();
    }

    public function test_create_team_requires_name(): void
    {
        $this->api()->postJson('/api/v1/teams', [])->assertUnprocessable();
    }

    public function test_update_team(): void
    {
        $response = $this->api()->putJson("/api/v1/teams/{$this->team->id}", [
            'name' => 'Renamed Team',
            'description' => 'New description',
        ]);

        $response->assertOk();
        $response->assertJsonPath('data.name', 'Renamed Team');
        $response->assertJsonPath('data.description', 'New description');
    }

    public function test_member_cannot_update_team(): void
    {
        $member = $this->addMember('member');

        $this->api($this->tokenFor($member))
            ->putJson("/api/v1/teams/{$this->team->id}", ['name' => 'Hijacked'])
            ->assertForbidden();
    }

    public function test_update_team_requires_manage_ability(): void
    {
        $token = $this->tokenFor($this->owner, ['read', 'write']);

        $this->api($token)
            ->putJson("/api/v1/teams/{$this->team->id}", ['name' => 'Nope'])
            ->assertForbidden();
    }

    public function test_delete_team_requires_confirmation(): void
    {
        $this->api()
            ->deleteJson("/api/v1/teams/{$this->team->id}")
            ->assertUnprocessable();

        $this->assertDatabaseHas('teams', ['id' => $this->team->id]);
    }

    public function test_delete_team(): void
    {
        $response = $this->api()->deleteJson("/api/v1/teams/{$this->team->id}", [
            'confirmation' => 'DELETE',
        ]);

        $response->assertNoContent();
        $this->assertDatabaseMissing('teams', ['id' => $this->team->id]);
    }

    public function test_admin_cannot_delete_team(): void
    {
        $admin = $this->addMember('admin');

        $this->api($this->tokenFor($admin))
            ->deleteJson("/api/v1/teams/{$this->team->id}", ['confirmation' => 'DELETE'])
            ->assertForbidden();

        $this->assertDatabaseHas('teams', ['id' => $this->team->id]);
    }

    public function test_non_member_cannot_view_or_update_team(): void
    {
        $stranger = User::factory()->create();

        $this->api($this->tokenFor($stranger))
            ->putJson("/api/v1/teams/{$this->team->id}", ['name' => 'Nope'])
            ->assertForbidden();
    }

    // ---- Member search ----

    public function test_member_search_excludes_existing_members(): void
    {
        $candidate = User::factory()->create(['name' => 'Searchable Sam']);
        User::factory()->create(['name' => 'Searchable Sue', 'deactivated_at' => now()]);
        $existing = User::factory()->create(['name' => 'Searchable Existing']);
        TeamMember::create(['team_id' => $this->team->id, 'user_id' => $existing->id, 'role' => 'member']);

        $response = $this->api()->getJson("/api/v1/teams/{$this->team->id}/members/search?q=Searchable");

        $response->assertOk();
        $response->assertJsonCount(1, 'data');
        $response->assertJsonPath('data.0.id', $candidate->id);
    }

    public function test_member_search_requires_two_characters(): void
    {
        User::factory()->create(['name' => 'Xavier']);

        $response = $this->api()->getJson("/api/v1/teams/{$this->team->id}/members/search?q=X");

        $response->assertOk();
        $response->assertJsonCount(0, 'data');
    }

    public function test_member_search_requires_manage_ability(): void
    {
        $token = $this->tokenFor($this->owner, ['read', 'write']);

        $this->api($token)
            ->getJson("/api/v1/teams/{$this->team->id}/members/search?q=anyone")
            ->assertForbidden();
    }

    // ---- Add member ----

    public function test_add_member(): void
    {
        $user = User::factory()->create();

        $response = $this->api()->postJson("/api/v1/teams/{$this->team->id}/members", [
            'user_id' => $user->id,
        ]);

        $response->assertCreated();
        $response->assertJsonPath('data.user_id', $user->id);
        $response->assertJsonPath('data.role', 'member');
        $this->assertDatabaseHas('team_members', [
            'team_id' => $this->team->id,
            'user_id' => $user->id,
            'role' => 'member',
        ]);
    }

    public function test_add_member_with_role(): void
    {
        $user = User::factory()->create();

        $response = $this->api()->postJson("/api/v1/teams/{$this->team->id}/members", [
            'user_id' => $user->id,
            'role' => 'admin',
        ]);

        $response->assertCreated();
        $response->assertJsonPath('data.role', 'admin');
    }

    public function test_admin_cannot_add_owner(): void
    {
        $admin = $this->addMember('admin');
        $user = User::factory()->create();

        $this->api($this->tokenFor($admin))
            ->postJson("/api/v1/teams/{$this->team->id}/members", [
                'user_id' => $user->id,
                'role' => 'owner',
            ])
            ->assertForbidden();
    }

    public function test_member_cannot_add_members(): void
    {
        $member = $this->addMember('member');
        $user = User::factory()->create();

        $this->api($this->tokenFor($member))
            ->postJson("/api/v1/teams/{$this->team->id}/members", ['user_id' => $user->id])
            ->assertForbidden();
    }

    public function test_cannot_add_existing_member(): void
    {
        $existing = $this->addMember('member');

        $this->api()
            ->postJson("/api/v1/teams/{$this->team->id}/members", ['user_id' => $existing->id])
            ->assertUnprocessable();
    }

    // ---- Update member role ----

    public function test_update_member_role(): void
    {
        $member = $this->addMember('member');

        $response = $this->api()->putJson("/api/v1/teams/{$this->team->id}/members/{$member->id}", [
            'role' => 'admin',
        ]);

        $response->assertOk();
        $response->assertJsonPath('data.role', 'admin');
        $this->assertDatabaseHas('team_members', [
            'team_id' => $this->team->id,
            'user_id' => $member->id,
            'role' => 'admin',
        ]);
    }

    public function test_admin_cannot_change_admin_role(): void
    {
        $admin = $this->addMember('admin');
        $otherAdmin = $this->addMember('admin');

        $this->api($this->tokenFor($admin))
            ->putJson("/api/v1/teams/{$this->team->id}/members/{$otherAdmin->id}", ['role' => 'member'])
            ->assertForbidden();
    }

    public function test_cannot_demote_last_owner(): void
    {
        $this->api()
            ->putJson("/api/v1/teams/{$this->team->id}/members/{$this->owner->id}", ['role' => 'member'])
            ->assertUnprocessable();
    }

    // ---- Remove member ----

    public function test_remove_member(): void
    {
        $member = $this->addMember('member');

        $response = $this->api()->deleteJson("/api/v1/teams/{$this->team->id}/members/{$member->id}");

        $response->assertNoContent();
        $this->assertDatabaseMissing('team_members', [
            'team_id' => $this->team->id,
            'user_id' => $member->id,
        ]);
    }

    public function test_admin_cannot_remove_admin(): void
    {
        $admin = $this->addMember('admin');
        $otherAdmin = $this->addMember('admin');

        $this->api($this->tokenFor($admin))
            ->deleteJson("/api/v1/teams/{$this->team->id}/members/{$otherAdmin->id}")
            ->assertForbidden();
    }

    public function test_cannot_remove_last_owner(): void
    {
        $this->api()
            ->deleteJson("/api/v1/teams/{$this->team->id}/members/{$this->owner->id}")
            ->assertUnprocessable();
    }

    public function test_member_endpoints_require_manage_ability(): void
    {
        $token = $this->tokenFor($this->owner, ['read', 'write']);
        $member = $this->addMember('member');

        $this->api($token)
            ->postJson("/api/v1/teams/{$this->team->id}/members", ['user_id' => User::factory()->create()->id])
            ->assertForbidden();

        $this->api($token)
            ->putJson("/api/v1/teams/{$this->team->id}/members/{$member->id}", ['role' => 'admin'])
            ->assertForbidden();

        $this->api($token)
            ->deleteJson("/api/v1/teams/{$this->team->id}/members/{$member->id}")
            ->assertForbidden();
    }
}
