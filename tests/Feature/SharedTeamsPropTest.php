<?php

namespace Tests\Feature;

use App\Models\Board;
use App\Models\Team;
use App\Models\TeamMember;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * The shared `teams` prop drives the team-grouped sidebar, the team
 * switcher, and the Teams index board previews.
 */
class SharedTeamsPropTest extends TestCase
{
    use RefreshDatabase;

    public function test_shared_teams_are_sorted_by_name_with_active_boards_and_role(): void
    {
        $user = User::factory()->create();

        $zeta = Team::factory()->create(['name' => 'Zeta Squad']);
        $alpha = Team::factory()->create(['name' => 'Alpha Crew']);
        $other = Team::factory()->create(['name' => 'Not Mine']);

        TeamMember::create(['team_id' => $zeta->id, 'user_id' => $user->id, 'role' => 'member']);
        TeamMember::create(['team_id' => $alpha->id, 'user_id' => $user->id, 'role' => 'admin']);

        $active = Board::factory()->create(['team_id' => $alpha->id, 'name' => 'Roadmap']);
        Board::factory()->create(['team_id' => $alpha->id, 'name' => 'Old', 'is_archived' => true]);
        Board::factory()->create(['team_id' => $other->id]);

        $this->actingAs($user)
            ->get(route('dashboard'))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->has('teams', 2)
                ->where('teams.0.name', 'Alpha Crew')
                ->where('teams.0.pivot.role', 'admin')
                ->has('teams.0.boards', 1)
                ->where('teams.0.boards.0.id', $active->id)
                ->where('teams.1.name', 'Zeta Squad')
                ->where('teams.1.pivot.role', 'member')
                ->etc()
            );
    }
}
