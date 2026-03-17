<?php

namespace Tests\Feature;

use App\Actions\Boards\CreateBoard;
use App\Actions\Boards\UpdateBoard;
use App\Actions\Teams\UpdateTeam;
use App\Models\Board;
use App\Models\Column;
use App\Models\Task;
use App\Models\Team;
use App\Models\TeamMember;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SlugRoutingTest extends TestCase
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
        $this->team = Team::factory()->create(['slug' => 'my-team']);
        TeamMember::create([
            'team_id' => $this->team->id,
            'user_id' => $this->user->id,
            'role' => 'owner',
        ]);
        $this->board = Board::factory()->create([
            'team_id' => $this->team->id,
            'slug' => 'my-board',
        ]);
        $this->column = Column::factory()->create([
            'board_id' => $this->board->id,
            'sort_order' => 0,
        ]);
    }

    public function test_team_resolves_by_slug(): void
    {
        $response = $this->actingAs($this->user)->get('/'.$this->team->slug);

        $response->assertOk();
    }

    public function test_team_resolves_by_uuid(): void
    {
        $response = $this->actingAs($this->user)->get('/'.$this->team->id);

        $response->assertOk();
    }

    public function test_board_resolves_by_slug(): void
    {
        $response = $this->actingAs($this->user)
            ->get('/'.$this->team->slug.'/'.$this->board->slug);

        $response->assertOk();
    }

    public function test_board_resolves_by_uuid(): void
    {
        $response = $this->actingAs($this->user)
            ->get('/'.$this->team->slug.'/'.$this->board->id);

        $response->assertOk();
    }

    public function test_task_resolves_by_number_slug(): void
    {
        $task = Task::factory()->create([
            'board_id' => $this->board->id,
            'column_id' => $this->column->id,
            'task_number' => 42,
            'title' => 'Fix Login Bug',
            'created_by' => $this->user->id,
        ]);

        $response = $this->actingAs($this->user)
            ->get('/'.$this->team->slug.'/'.$this->board->slug.'/tasks/42-fix-login-bug');

        $response->assertOk();
    }

    public function test_task_resolves_by_uuid(): void
    {
        $task = Task::factory()->create([
            'board_id' => $this->board->id,
            'column_id' => $this->column->id,
            'task_number' => 1,
            'title' => 'Test Task',
            'created_by' => $this->user->id,
        ]);

        $response = $this->actingAs($this->user)
            ->get('/'.$this->team->slug.'/'.$this->board->slug.'/tasks/'.$task->id);

        $response->assertOk();
    }

    public function test_task_slug_attribute(): void
    {
        $task = Task::factory()->create([
            'board_id' => $this->board->id,
            'column_id' => $this->column->id,
            'task_number' => 42,
            'title' => 'Fix Login Bug',
            'created_by' => $this->user->id,
        ]);

        $this->assertEquals('42-fix-login-bug', $task->slug);
    }

    public function test_task_route_key_uses_slug(): void
    {
        $task = Task::factory()->create([
            'board_id' => $this->board->id,
            'column_id' => $this->column->id,
            'task_number' => 42,
            'title' => 'Fix Login Bug',
            'created_by' => $this->user->id,
        ]);

        $this->assertEquals('42-fix-login-bug', $task->getRouteKey());
    }

    public function test_team_route_key_uses_slug(): void
    {
        $this->assertEquals('my-team', $this->team->getRouteKey());
    }

    public function test_board_route_key_uses_slug(): void
    {
        $this->assertEquals('my-board', $this->board->getRouteKey());
    }

    public function test_slug_auto_generated_on_board_create(): void
    {
        $board = CreateBoard::run($this->team, ['name' => 'Sprint Planning']);

        $this->assertEquals('sprint-planning', $board->slug);
    }

    public function test_slug_uniqueness_within_team_on_create(): void
    {
        Board::factory()->create([
            'team_id' => $this->team->id,
            'slug' => 'sprint-planning',
        ]);

        $board = CreateBoard::run($this->team, ['name' => 'Sprint Planning']);

        $this->assertEquals('sprint-planning-1', $board->slug);
    }

    public function test_slug_updated_on_board_rename(): void
    {
        $board = Board::factory()->create([
            'team_id' => $this->team->id,
            'slug' => 'old-name',
            'name' => 'Old Name',
        ]);

        $updated = UpdateBoard::run($board, ['name' => 'New Name']);

        $this->assertEquals('new-name', $updated->slug);
    }

    public function test_custom_slug_override_on_board_update(): void
    {
        $board = Board::factory()->create([
            'team_id' => $this->team->id,
            'slug' => 'original',
            'name' => 'Original',
        ]);

        $updated = UpdateBoard::run($board, ['slug' => 'Custom Slug']);

        $this->assertEquals('custom-slug', $updated->slug);
    }

    public function test_custom_slug_override_on_team_update(): void
    {
        $updated = UpdateTeam::run($this->team, ['slug' => 'Custom Team Slug']);

        $this->assertEquals('custom-team-slug', $updated->slug);
    }

    public function test_team_slug_regenerated_on_rename(): void
    {
        $updated = UpdateTeam::run($this->team, ['name' => 'New Team Name']);

        $this->assertEquals('new-team-name', $updated->slug);
    }

    public function test_static_routes_not_caught_by_team_slug(): void
    {
        $this->actingAs($this->user);

        $this->get('/dashboard')->assertOk();
        $this->get('/profile')->assertOk();
        $this->get('/templates')->assertOk();
        $this->get('/notifications')->assertOk();
    }

    public function test_board_scoped_to_team(): void
    {
        $otherTeam = Team::factory()->create(['slug' => 'other-team']);
        TeamMember::create([
            'team_id' => $otherTeam->id,
            'user_id' => $this->user->id,
            'role' => 'member',
        ]);

        // Board belongs to $this->team, not $otherTeam
        $response = $this->actingAs($this->user)
            ->get('/'.$otherTeam->slug.'/'.$this->board->slug);

        $response->assertNotFound();
    }

    public function test_task_scoped_to_board(): void
    {
        $otherBoard = Board::factory()->create([
            'team_id' => $this->team->id,
            'slug' => 'other-board',
        ]);

        $task = Task::factory()->create([
            'board_id' => $this->board->id,
            'column_id' => $this->column->id,
            'task_number' => 99,
            'title' => 'Scoped Task',
            'created_by' => $this->user->id,
        ]);

        // Task belongs to $this->board, not $otherBoard
        $response = $this->actingAs($this->user)
            ->get('/'.$this->team->slug.'/'.$otherBoard->slug.'/tasks/99-scoped-task');

        $response->assertNotFound();
    }
}
