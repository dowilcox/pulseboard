<?php

namespace Tests\Feature;

use App\Models\Board;
use App\Models\Column;
use App\Models\SavedFilter;
use App\Models\Team;
use App\Models\TeamMember;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia;
use Tests\TestCase;

class BoardShowPropsTest extends TestCase
{
    use RefreshDatabase;

    private Team $team;

    private Board $board;

    protected function setUp(): void
    {
        parent::setUp();

        $this->team = Team::factory()->create();
        $this->board = Board::factory()->create(['team_id' => $this->team->id]);
        Column::factory()->create(['board_id' => $this->board->id]);
    }

    private function member(string $role): User
    {
        $user = User::factory()->create();
        TeamMember::create([
            'team_id' => $this->team->id,
            'user_id' => $user->id,
            'role' => $role,
        ]);

        return $user;
    }

    public function test_board_show_includes_only_the_viewers_saved_filters(): void
    {
        $viewer = $this->member('member');
        $colleague = $this->member('member');
        $otherBoard = Board::factory()->create(['team_id' => $this->team->id]);

        SavedFilter::create([
            'board_id' => $this->board->id,
            'user_id' => $viewer->id,
            'name' => 'My Tasks',
            'filter_config' => ['assignees' => [$viewer->id]],
            'is_default' => true,
        ]);
        SavedFilter::create([
            'board_id' => $this->board->id,
            'user_id' => $colleague->id,
            'name' => 'Colleague filter',
            'filter_config' => ['priorities' => ['high']],
        ]);
        SavedFilter::create([
            'board_id' => $otherBoard->id,
            'user_id' => $viewer->id,
            'name' => 'Other board filter',
            'filter_config' => ['priorities' => ['low']],
        ]);

        $this->actingAs($viewer)
            ->get(route('teams.boards.show', [$this->team, $this->board]))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('Boards/Show')
                ->has('savedFilters', 1)
                ->where('savedFilters.0.name', 'My Tasks')
                ->where('savedFilters.0.is_default', true)
                ->where('savedFilters.0.filter_config.assignees.0', $viewer->id)
            );
    }

    public function test_board_show_exposes_update_permission_for_admins(): void
    {
        $admin = $this->member('admin');

        $this->actingAs($admin)
            ->get(route('teams.boards.show', [$this->team, $this->board]))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->where('can.update', true)
            );
    }

    public function test_board_show_hides_update_permission_from_members(): void
    {
        $member = $this->member('member');

        $this->actingAs($member)
            ->get(route('teams.boards.show', [$this->team, $this->board]))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->where('can.update', false)
            );
    }

    public function test_board_show_ignores_view_and_filter_query_parameters(): void
    {
        $member = $this->member('member');

        $this->actingAs($member)
            ->get(route('teams.boards.show', [$this->team, $this->board]).'?view=list&q=search&priority=high,urgent&filter=none')
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('Boards/Show')
                ->where('board.id', $this->board->id)
            );
    }
}
