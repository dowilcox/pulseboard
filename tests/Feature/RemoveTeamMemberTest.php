<?php

namespace Tests\Feature;

use App\Actions\Teams\RemoveTeamMember;
use App\Models\Team;
use App\Models\TeamMember;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

class RemoveTeamMemberTest extends TestCase
{
    use RefreshDatabase;

    private Team $team;

    protected function setUp(): void
    {
        parent::setUp();
        $this->team = Team::factory()->create();
    }

    private function addMember(User $user, string $role = 'member'): void
    {
        TeamMember::create([
            'team_id' => $this->team->id,
            'user_id' => $user->id,
            'role' => $role,
        ]);
    }

    public function test_can_remove_regular_member(): void
    {
        $member = User::factory()->create();
        $this->addMember($member);

        RemoveTeamMember::run($this->team, $member);

        $this->assertDatabaseMissing('team_members', [
            'team_id' => $this->team->id,
            'user_id' => $member->id,
        ]);
    }

    public function test_can_remove_admin(): void
    {
        $admin = User::factory()->create();
        $this->addMember($admin, 'admin');

        RemoveTeamMember::run($this->team, $admin);

        $this->assertDatabaseMissing('team_members', [
            'team_id' => $this->team->id,
            'user_id' => $admin->id,
        ]);
    }

    public function test_can_remove_owner_when_multiple_owners(): void
    {
        $owner1 = User::factory()->create();
        $owner2 = User::factory()->create();
        $this->addMember($owner1, 'owner');
        $this->addMember($owner2, 'owner');

        RemoveTeamMember::run($this->team, $owner1);

        $this->assertDatabaseMissing('team_members', [
            'team_id' => $this->team->id,
            'user_id' => $owner1->id,
        ]);
    }

    public function test_cannot_remove_last_owner(): void
    {
        $owner = User::factory()->create();
        $this->addMember($owner, 'owner');

        $this->expectException(ValidationException::class);
        RemoveTeamMember::run($this->team, $owner);
    }

    public function test_cannot_remove_non_member(): void
    {
        $nonMember = User::factory()->create();

        $this->expectException(ValidationException::class);
        RemoveTeamMember::run($this->team, $nonMember);
    }

    public function test_removing_bot_deactivates_and_revokes_tokens(): void
    {
        $bot = User::factory()->create([
            'is_bot' => true,
            'created_by_team_id' => $this->team->id,
        ]);
        $this->addMember($bot);

        // Create a personal access token for the bot
        $bot->createToken('test-token');
        $this->assertEquals(1, $bot->tokens()->count());

        RemoveTeamMember::run($this->team, $bot);

        $bot->refresh();
        $this->assertNotNull($bot->deactivated_at);
        $this->assertEquals(0, $bot->tokens()->count());
    }

    public function test_removing_bot_from_different_team_does_not_deactivate(): void
    {
        $otherTeam = Team::factory()->create();

        $bot = User::factory()->create([
            'is_bot' => true,
            'created_by_team_id' => $otherTeam->id,
        ]);
        $this->addMember($bot);

        RemoveTeamMember::run($this->team, $bot);

        $bot->refresh();
        $this->assertNull($bot->deactivated_at);
    }

    public function test_removing_regular_user_does_not_deactivate(): void
    {
        $user = User::factory()->create(['is_bot' => false]);
        $this->addMember($user);

        RemoveTeamMember::run($this->team, $user);

        $user->refresh();
        $this->assertNull($user->deactivated_at);
    }
}
