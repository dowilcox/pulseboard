<?php

namespace Tests\Feature;

use App\Actions\Teams\CreateBotUser;
use App\Actions\Teams\DeleteTeam;
use App\Models\Team;
use App\Models\TeamMember;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DeleteTeamBotCleanupTest extends TestCase
{
    use RefreshDatabase;

    public function test_deleting_team_deletes_its_bot_users_and_tokens(): void
    {
        $owner = User::factory()->create();
        $team = Team::factory()->create();
        TeamMember::create([
            'team_id' => $team->id,
            'user_id' => $owner->id,
            'role' => 'owner',
        ]);

        $bot = CreateBotUser::run($team, ['name' => 'Deploy Bot']);
        $bot->createToken('ci-token');

        DeleteTeam::run($team);

        $this->assertDatabaseMissing('teams', ['id' => $team->id]);
        $this->assertDatabaseMissing('users', ['id' => $bot->id]);
        $this->assertDatabaseMissing('personal_access_tokens', [
            'tokenable_id' => $bot->id,
        ]);

        // Human members are not deleted with the team
        $this->assertDatabaseHas('users', ['id' => $owner->id]);
    }

    public function test_deleting_team_deletes_deactivated_bots_too(): void
    {
        $owner = User::factory()->create();
        $team = Team::factory()->create();
        TeamMember::create([
            'team_id' => $team->id,
            'user_id' => $owner->id,
            'role' => 'owner',
        ]);

        $bot = CreateBotUser::run($team, ['name' => 'Old Bot']);
        $bot->createToken('stale-token');
        $bot->tokens()->delete();
        $bot->update(['deactivated_at' => now()]);

        DeleteTeam::run($team);

        $this->assertDatabaseMissing('users', ['id' => $bot->id]);
    }

    public function test_deleting_team_does_not_delete_other_teams_bots(): void
    {
        $owner = User::factory()->create();
        $teamA = Team::factory()->create();
        $teamB = Team::factory()->create();

        foreach ([$teamA, $teamB] as $team) {
            TeamMember::create([
                'team_id' => $team->id,
                'user_id' => $owner->id,
                'role' => 'owner',
            ]);
        }

        $botB = CreateBotUser::run($teamB, ['name' => 'Other Bot']);
        $botB->createToken('other-token');

        DeleteTeam::run($teamA);

        $this->assertDatabaseHas('users', ['id' => $botB->id]);
        $this->assertDatabaseHas('personal_access_tokens', [
            'tokenable_id' => $botB->id,
        ]);
    }
}
