<?php

namespace Tests\Feature;

use App\Models\Team;
use App\Models\TeamMember;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class TeamManagementTest extends TestCase
{
    use RefreshDatabase;

    private User $user;

    private Team $team;

    protected function setUp(): void
    {
        parent::setUp();

        $this->user = User::factory()->create();
        $this->team = Team::factory()->create();
        $this->addTeamMember($this->user, $this->team, 'owner');
    }

    private function addTeamMember(User $user, Team $team, string $role = 'member'): void
    {
        TeamMember::create([
            'team_id' => $team->id,
            'user_id' => $user->id,
            'role' => $role,
        ]);
    }

    // ---------------------------------------------------------------
    // TeamController Tests
    // ---------------------------------------------------------------

    public function test_can_list_teams(): void
    {
        $response = $this->actingAs($this->user)->get(route('teams.index'));

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->component('Teams/Index')
            ->has('pageTeams', 1)
        );
    }

    public function test_can_create_team(): void
    {
        $response = $this->actingAs($this->user)->post(route('teams.store'), [
            'name' => 'New Team',
            'description' => 'A brand new team',
        ]);

        $response->assertRedirect();
        $this->assertDatabaseHas('teams', [
            'name' => 'New Team',
            'description' => 'A brand new team',
        ]);
    }

    public function test_can_view_team(): void
    {
        $response = $this->actingAs($this->user)->get(route('teams.show', $this->team));

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->component('Teams/Show')
            ->has('team')
            ->has('members')
            ->has('boards')
        );
    }

    public function test_can_update_team(): void
    {
        $response = $this->actingAs($this->user)->put(route('teams.update', $this->team), [
            'name' => 'Updated Team Name',
            'description' => 'Updated description',
        ]);

        $response->assertRedirect();
        $this->team->refresh();
        $this->assertEquals('Updated Team Name', $this->team->name);
        $this->assertEquals('Updated description', $this->team->description);
    }

    public function test_member_cannot_update_team(): void
    {
        $member = User::factory()->create();
        $this->addTeamMember($member, $this->team, 'member');

        $response = $this->actingAs($member)->put(route('teams.update', $this->team), [
            'name' => 'Hijacked Name',
        ]);

        $response->assertForbidden();
    }

    public function test_owner_can_delete_team(): void
    {
        $response = $this->actingAs($this->user)->delete(route('teams.destroy', $this->team));

        $response->assertRedirect(route('teams.index'));
        $this->assertDatabaseMissing('teams', ['id' => $this->team->id]);
    }

    public function test_admin_cannot_delete_team(): void
    {
        $admin = User::factory()->create();
        $this->addTeamMember($admin, $this->team, 'admin');

        $response = $this->actingAs($admin)->delete(route('teams.destroy', $this->team));

        $response->assertForbidden();
    }

    public function test_can_view_settings(): void
    {
        $response = $this->actingAs($this->user)->get(route('teams.settings', $this->team));

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->component('Teams/Settings')
            ->has('team')
            ->has('labels')
            ->has('members')
            ->has('canManageMembers')
            ->has('canManageAdmins')
        );
    }

    // ---------------------------------------------------------------
    // TeamMemberController Tests
    // ---------------------------------------------------------------

    public function test_admin_can_add_member(): void
    {
        $admin = User::factory()->create();
        $this->addTeamMember($admin, $this->team, 'admin');

        $newUser = User::factory()->create();

        $response = $this->actingAs($admin)->post(route('teams.members.store', $this->team), [
            'user_id' => $newUser->id,
            'role' => 'member',
        ]);

        $response->assertRedirect(route('teams.settings', $this->team));
        $this->assertDatabaseHas('team_members', [
            'team_id' => $this->team->id,
            'user_id' => $newUser->id,
            'role' => 'member',
        ]);
    }

    public function test_member_cannot_add_member(): void
    {
        $member = User::factory()->create();
        $this->addTeamMember($member, $this->team, 'member');

        $newUser = User::factory()->create();

        $response = $this->actingAs($member)->post(route('teams.members.store', $this->team), [
            'user_id' => $newUser->id,
            'role' => 'member',
        ]);

        $response->assertForbidden();
    }

    public function test_can_search_users(): void
    {
        $searchable = User::factory()->create(['name' => 'Findable Person']);

        $response = $this->actingAs($this->user)->getJson(
            route('teams.members.search', $this->team).'?q=Findable'
        );

        $response->assertOk();
        $response->assertJsonFragment(['name' => 'Findable Person']);
    }

    public function test_can_update_member_role(): void
    {
        $member = User::factory()->create();
        $this->addTeamMember($member, $this->team, 'member');

        $response = $this->actingAs($this->user)->put(
            route('teams.members.update', [$this->team, $member]),
            ['role' => 'admin']
        );

        $response->assertRedirect(route('teams.settings', $this->team));
        $this->assertDatabaseHas('team_members', [
            'team_id' => $this->team->id,
            'user_id' => $member->id,
            'role' => 'admin',
        ]);
    }

    public function test_can_remove_member(): void
    {
        $member = User::factory()->create();
        $this->addTeamMember($member, $this->team, 'member');

        $response = $this->actingAs($this->user)->delete(
            route('teams.members.destroy', [$this->team, $member])
        );

        $response->assertRedirect(route('teams.settings', $this->team));
        $this->assertDatabaseMissing('team_members', [
            'team_id' => $this->team->id,
            'user_id' => $member->id,
        ]);
    }
}
