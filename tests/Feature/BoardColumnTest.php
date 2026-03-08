<?php

namespace Tests\Feature;

use App\Models\Board;
use App\Models\Column;
use App\Models\Team;
use App\Models\TeamMember;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class BoardColumnTest extends TestCase
{
    use RefreshDatabase;

    private User $user;

    private Team $team;

    private Board $board;

    private Column $column;

    protected function setUp(): void
    {
        parent::setUp();

        $this->user = User::factory()->create();
        $this->team = Team::factory()->create();
        $this->addTeamMember($this->user, $this->team, 'owner');
        $this->board = Board::factory()->create(['team_id' => $this->team->id]);
        $this->column = Column::factory()->create(['board_id' => $this->board->id]);
    }

    private function addTeamMember(User $user, Team $team, string $role = 'member'): void
    {
        TeamMember::create([
            'team_id' => $team->id,
            'user_id' => $user->id,
            'role' => $role,
        ]);
    }

    // ── BoardController Tests ───────────────────────────────────────────

    public function test_can_create_board(): void
    {
        $response = $this->actingAs($this->user)->post(
            route('teams.boards.store', $this->team),
            ['name' => 'New Board', 'description' => 'A test board']
        );

        $response->assertRedirect();
        $this->assertDatabaseHas('boards', [
            'team_id' => $this->team->id,
            'name' => 'New Board',
            'description' => 'A test board',
        ]);
    }

    public function test_create_board_requires_name(): void
    {
        $response = $this->actingAs($this->user)->post(
            route('teams.boards.store', $this->team),
            ['name' => '', 'description' => 'Missing name']
        );

        $response->assertSessionHasErrors('name');
    }

    public function test_can_view_board(): void
    {
        $response = $this->actingAs($this->user)->get(
            route('teams.boards.show', [$this->team, $this->board])
        );

        $response->assertOk();
    }

    public function test_can_update_board(): void
    {
        $response = $this->actingAs($this->user)->put(
            route('teams.boards.update', [$this->team, $this->board]),
            ['name' => 'Updated Board Name', 'description' => 'Updated description']
        );

        $response->assertRedirect();
        $this->board->refresh();
        $this->assertEquals('Updated Board Name', $this->board->name);
        $this->assertEquals('Updated description', $this->board->description);
    }

    public function test_can_archive_board(): void
    {
        $response = $this->actingAs($this->user)->post(
            route('teams.boards.archive', [$this->team, $this->board])
        );

        $response->assertRedirect();
        $this->board->refresh();
        $this->assertTrue($this->board->is_archived);
    }

    public function test_can_view_board_settings(): void
    {
        $response = $this->actingAs($this->user)->get(
            route('teams.boards.settings', [$this->team, $this->board])
        );

        $response->assertOk();
    }

    public function test_non_member_cannot_access_board(): void
    {
        $outsider = User::factory()->create();

        $response = $this->actingAs($outsider)->get(
            route('teams.boards.show', [$this->team, $this->board])
        );

        $response->assertForbidden();
    }

    // ── ColumnController Tests ──────────────────────────────────────────

    public function test_can_create_column(): void
    {
        $response = $this->actingAs($this->user)->post(
            route('teams.boards.columns.store', [$this->team, $this->board]),
            ['name' => 'In Progress']
        );

        $response->assertRedirect();
        $this->assertDatabaseHas('columns', [
            'board_id' => $this->board->id,
            'name' => 'In Progress',
        ]);
    }

    public function test_can_update_column(): void
    {
        $response = $this->actingAs($this->user)->put(
            route('teams.boards.columns.update', [$this->team, $this->board, $this->column]),
            ['name' => 'Done', 'wip_limit' => 5]
        );

        $response->assertRedirect();
        $this->column->refresh();
        $this->assertEquals('Done', $this->column->name);
        $this->assertEquals(5, $this->column->wip_limit);
    }

    public function test_can_reorder_columns(): void
    {
        $column2 = Column::factory()->create(['board_id' => $this->board->id]);
        $column3 = Column::factory()->create(['board_id' => $this->board->id]);

        $response = $this->actingAs($this->user)->put(
            route('teams.boards.columns.reorder', [$this->team, $this->board]),
            ['column_ids' => [$column3->id, $this->column->id, $column2->id]]
        );

        $response->assertRedirect();

        $column3->refresh();
        $this->column->refresh();
        $column2->refresh();

        $this->assertLessThan($this->column->sort_order, $column3->sort_order);
        $this->assertLessThan($column2->sort_order, $this->column->sort_order);
    }

    public function test_can_delete_column(): void
    {
        $columnToDelete = Column::factory()->create(['board_id' => $this->board->id]);

        $response = $this->actingAs($this->user)->delete(
            route('teams.boards.columns.destroy', [$this->team, $this->board, $columnToDelete])
        );

        $response->assertRedirect();
        $this->assertDatabaseMissing('columns', ['id' => $columnToDelete->id]);
    }
}
