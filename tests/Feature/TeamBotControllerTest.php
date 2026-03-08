<?php

namespace Tests\Feature;

use App\Models\Team;
use App\Models\TeamMember;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class TeamBotControllerTest extends TestCase
{
    use RefreshDatabase;

    private function createTeamWithRole(string $role): array
    {
        $user = User::factory()->create();
        $team = Team::factory()->create();
        TeamMember::create([
            'team_id' => $team->id,
            'user_id' => $user->id,
            'role' => $role,
        ]);

        return [$user, $team];
    }

    public function test_team_owner_can_view_bots_page(): void
    {
        [$user, $team] = $this->createTeamWithRole('owner');

        $response = $this->actingAs($user)->get(route('teams.bots.index', $team));

        $response->assertOk();
    }

    public function test_team_admin_can_view_bots_page(): void
    {
        [$user, $team] = $this->createTeamWithRole('admin');

        $response = $this->actingAs($user)->get(route('teams.bots.index', $team));

        $response->assertOk();
    }

    public function test_team_member_cannot_view_bots_page(): void
    {
        [$user, $team] = $this->createTeamWithRole('member');

        $response = $this->actingAs($user)->get(route('teams.bots.index', $team));

        $response->assertForbidden();
    }

    public function test_team_admin_can_create_bot(): void
    {
        [$user, $team] = $this->createTeamWithRole('admin');

        $response = $this->actingAs($user)->post(route('teams.bots.store', $team), [
            'name' => 'Test Bot',
        ]);

        $response->assertRedirect();
        $this->assertDatabaseHas('users', [
            'name' => 'Test Bot',
            'is_bot' => true,
            'created_by_team_id' => $team->id,
        ]);

        // Bot should be added as team member
        $bot = User::where('name', 'Test Bot')->first();
        $this->assertTrue($team->hasUser($bot));
    }

    public function test_team_member_cannot_create_bot(): void
    {
        [$user, $team] = $this->createTeamWithRole('member');

        $response = $this->actingAs($user)->post(route('teams.bots.store', $team), [
            'name' => 'Test Bot',
        ]);

        $response->assertForbidden();
    }

    public function test_can_create_token_for_team_bot(): void
    {
        [$user, $team] = $this->createTeamWithRole('owner');

        // Create a bot for this team
        $bot = User::create([
            'name' => 'Bot',
            'email' => 'bot@pulseboard.local',
            'password' => bcrypt('secret'),
            'is_bot' => true,
            'is_admin' => false,
            'auth_provider' => 'local',
            'created_by_team_id' => $team->id,
        ]);
        TeamMember::create(['team_id' => $team->id, 'user_id' => $bot->id, 'role' => 'member']);

        $response = $this->actingAs($user)->post(route('teams.bots.create-token', [$team, $bot]), [
            'name' => 'my-token',
            'abilities' => ['read'],
        ]);

        $response->assertRedirect();
        $response->assertSessionHas('success');
        $this->assertCount(1, $bot->fresh()->tokens);
    }

    public function test_cannot_create_token_for_other_teams_bot(): void
    {
        [$user, $team] = $this->createTeamWithRole('owner');

        $otherTeam = Team::factory()->create();
        $bot = User::create([
            'name' => 'Other Bot',
            'email' => 'other-bot@pulseboard.local',
            'password' => bcrypt('secret'),
            'is_bot' => true,
            'is_admin' => false,
            'auth_provider' => 'local',
            'created_by_team_id' => $otherTeam->id,
        ]);

        $response = $this->actingAs($user)->post(route('teams.bots.create-token', [$team, $bot]), [
            'name' => 'my-token',
            'abilities' => ['read'],
        ]);

        $response->assertForbidden();
    }

    public function test_can_revoke_token(): void
    {
        [$user, $team] = $this->createTeamWithRole('owner');

        $bot = User::create([
            'name' => 'Bot',
            'email' => 'bot2@pulseboard.local',
            'password' => bcrypt('secret'),
            'is_bot' => true,
            'is_admin' => false,
            'auth_provider' => 'local',
            'created_by_team_id' => $team->id,
        ]);
        TeamMember::create(['team_id' => $team->id, 'user_id' => $bot->id, 'role' => 'member']);
        $token = $bot->createToken('test', ['read']);

        $response = $this->actingAs($user)->delete(
            route('teams.bots.revoke-token', [$team, $bot, $token->accessToken->id])
        );

        $response->assertRedirect();
        $this->assertCount(0, $bot->fresh()->tokens);
    }

    public function test_can_destroy_bot(): void
    {
        [$user, $team] = $this->createTeamWithRole('owner');

        $bot = User::create([
            'name' => 'Bot',
            'email' => 'bot3@pulseboard.local',
            'password' => bcrypt('secret'),
            'is_bot' => true,
            'is_admin' => false,
            'auth_provider' => 'local',
            'created_by_team_id' => $team->id,
        ]);
        TeamMember::create(['team_id' => $team->id, 'user_id' => $bot->id, 'role' => 'member']);
        $bot->createToken('test', ['read']);

        $response = $this->actingAs($user)->delete(route('teams.bots.destroy', [$team, $bot]));

        $response->assertRedirect();
        $this->assertNotNull($bot->fresh()->deactivated_at);
        $this->assertCount(0, $bot->fresh()->tokens);
        $this->assertFalse($team->hasUser($bot));
    }
}
