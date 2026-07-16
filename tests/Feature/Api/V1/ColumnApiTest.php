<?php

namespace Tests\Feature\Api\V1;

use App\Models\Board;
use App\Models\Column;
use App\Models\Task;
use App\Models\Team;
use App\Models\TeamMember;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ColumnApiTest extends TestCase
{
    use RefreshDatabase;

    private User $user;

    private Team $team;

    private Board $board;

    private Column $column;

    private string $token;

    protected function setUp(): void
    {
        parent::setUp();

        $this->user = User::factory()->create();
        $this->team = Team::factory()->create();
        TeamMember::create(['team_id' => $this->team->id, 'user_id' => $this->user->id, 'role' => 'owner']);
        $this->board = Board::factory()->create(['team_id' => $this->team->id]);
        $this->column = Column::factory()->create(['board_id' => $this->board->id, 'sort_order' => 0]);
        $this->token = $this->user->createToken('test', ['read', 'write', 'manage'])->plainTextToken;
    }

    private function api(): static
    {
        return $this->withHeader('Authorization', "Bearer {$this->token}");
    }

    private function memberApi(): static
    {
        $member = User::factory()->create();
        TeamMember::create(['team_id' => $this->team->id, 'user_id' => $member->id, 'role' => 'member']);
        $token = $member->createToken('member', ['read', 'write', 'manage'])->plainTextToken;

        return $this->withHeader('Authorization', "Bearer {$token}");
    }

    public function test_create_column(): void
    {
        $response = $this->api()->postJson(
            "/api/v1/teams/{$this->team->id}/boards/{$this->board->id}/columns",
            ['name' => 'QA', 'color' => '#ff0000', 'wip_limit' => 3]
        );

        $response->assertCreated();
        $response->assertJsonPath('data.name', 'QA');
        $response->assertJsonPath('data.color', '#ff0000');
        $response->assertJsonPath('data.wip_limit', 3);
        $this->assertDatabaseHas('columns', ['name' => 'QA', 'board_id' => $this->board->id]);
    }

    public function test_create_done_column_unsets_previous_done_column(): void
    {
        $done = Column::factory()->create(['board_id' => $this->board->id, 'is_done_column' => true]);

        $response = $this->api()->postJson(
            "/api/v1/teams/{$this->team->id}/boards/{$this->board->id}/columns",
            ['name' => 'Shipped', 'is_done_column' => true]
        );

        $response->assertCreated();
        $this->assertFalse((bool) $done->fresh()->is_done_column);
    }

    public function test_create_column_requires_manage_ability(): void
    {
        $writeToken = $this->user->createToken('write-only', ['read', 'write'])->plainTextToken;

        $response = $this->withHeader('Authorization', "Bearer {$writeToken}")->postJson(
            "/api/v1/teams/{$this->team->id}/boards/{$this->board->id}/columns",
            ['name' => 'Nope']
        );

        $response->assertForbidden();
    }

    public function test_regular_member_cannot_create_column(): void
    {
        $response = $this->memberApi()->postJson(
            "/api/v1/teams/{$this->team->id}/boards/{$this->board->id}/columns",
            ['name' => 'Nope']
        );

        $response->assertForbidden();
    }

    public function test_update_column(): void
    {
        $response = $this->api()->putJson(
            "/api/v1/teams/{$this->team->id}/boards/{$this->board->id}/columns/{$this->column->id}",
            ['name' => 'Renamed', 'color' => '#00ff00']
        );

        $response->assertOk();
        $response->assertJsonPath('data.name', 'Renamed');
        $response->assertJsonPath('data.color', '#00ff00');
    }

    public function test_update_column_from_another_board_returns_404(): void
    {
        $otherBoard = Board::factory()->create(['team_id' => $this->team->id]);
        $foreignColumn = Column::factory()->create(['board_id' => $otherBoard->id]);

        $response = $this->api()->putJson(
            "/api/v1/teams/{$this->team->id}/boards/{$this->board->id}/columns/{$foreignColumn->id}",
            ['name' => 'Nope']
        );

        $response->assertNotFound();
    }

    public function test_reorder_columns_syncs_create_update_and_delete(): void
    {
        $second = Column::factory()->create(['board_id' => $this->board->id, 'sort_order' => 1]);

        $response = $this->api()->putJson(
            "/api/v1/teams/{$this->team->id}/boards/{$this->board->id}/columns",
            [
                'columns' => [
                    [
                        'id' => $this->column->id,
                        'name' => 'First Renamed',
                        'color' => '#111111',
                        'sort_order' => 1,
                        'is_done_column' => false,
                    ],
                    [
                        'id' => $second->id,
                        'name' => $second->name,
                        'color' => '#222222',
                        'sort_order' => 0,
                        'is_done_column' => false,
                        '_destroy' => true,
                    ],
                    [
                        'name' => 'Brand New',
                        'color' => '#333333',
                        'sort_order' => 0,
                        'is_done_column' => true,
                    ],
                ],
            ]
        );

        $response->assertOk();
        $response->assertJsonCount(2, 'data.columns');
        $this->assertDatabaseMissing('columns', ['id' => $second->id]);
        $this->assertDatabaseHas('columns', ['name' => 'First Renamed', 'sort_order' => 1]);
        $this->assertDatabaseHas('columns', ['name' => 'Brand New', 'board_id' => $this->board->id, 'sort_order' => 0]);
    }

    public function test_reorder_cannot_destroy_all_columns(): void
    {
        $response = $this->api()->putJson(
            "/api/v1/teams/{$this->team->id}/boards/{$this->board->id}/columns",
            [
                'columns' => [
                    [
                        'id' => $this->column->id,
                        'name' => $this->column->name,
                        'color' => '#111111',
                        'sort_order' => 0,
                        '_destroy' => true,
                    ],
                ],
            ]
        );

        $response->assertUnprocessable();
        $response->assertJsonValidationErrors(['columns']);
        $this->assertDatabaseHas('columns', ['id' => $this->column->id]);
    }

    public function test_delete_column_without_target_deletes_its_tasks(): void
    {
        Column::factory()->create(['board_id' => $this->board->id, 'sort_order' => 1]);
        $task = Task::factory()->create([
            'board_id' => $this->board->id,
            'column_id' => $this->column->id,
            'created_by' => $this->user->id,
        ]);

        $response = $this->api()->deleteJson(
            "/api/v1/teams/{$this->team->id}/boards/{$this->board->id}/columns/{$this->column->id}"
        );

        $response->assertNoContent();
        $this->assertDatabaseMissing('columns', ['id' => $this->column->id]);
        $this->assertDatabaseMissing('tasks', ['id' => $task->id]);
    }

    public function test_delete_column_moves_tasks_to_target_column(): void
    {
        $target = Column::factory()->create(['board_id' => $this->board->id, 'sort_order' => 1]);
        $task = Task::factory()->create([
            'board_id' => $this->board->id,
            'column_id' => $this->column->id,
            'created_by' => $this->user->id,
        ]);

        $response = $this->api()->deleteJson(
            "/api/v1/teams/{$this->team->id}/boards/{$this->board->id}/columns/{$this->column->id}",
            ['target_column_id' => $target->id]
        );

        $response->assertNoContent();
        $this->assertDatabaseMissing('columns', ['id' => $this->column->id]);
        $this->assertEquals($target->id, $task->fresh()->column_id);
    }

    public function test_delete_column_with_invalid_target_returns_404(): void
    {
        Column::factory()->create(['board_id' => $this->board->id, 'sort_order' => 1]);
        $otherBoard = Board::factory()->create(['team_id' => $this->team->id]);
        $foreignTarget = Column::factory()->create(['board_id' => $otherBoard->id]);

        $response = $this->api()->deleteJson(
            "/api/v1/teams/{$this->team->id}/boards/{$this->board->id}/columns/{$this->column->id}",
            ['target_column_id' => $foreignTarget->id]
        );

        $response->assertNotFound();
        $this->assertDatabaseHas('columns', ['id' => $this->column->id]);
    }

    public function test_cannot_delete_last_column(): void
    {
        $response = $this->api()->deleteJson(
            "/api/v1/teams/{$this->team->id}/boards/{$this->board->id}/columns/{$this->column->id}"
        );

        $response->assertUnprocessable();
        $response->assertJsonValidationErrors(['column']);
        $this->assertDatabaseHas('columns', ['id' => $this->column->id]);
    }

    public function test_regular_member_cannot_delete_column(): void
    {
        Column::factory()->create(['board_id' => $this->board->id, 'sort_order' => 1]);

        $response = $this->memberApi()->deleteJson(
            "/api/v1/teams/{$this->team->id}/boards/{$this->board->id}/columns/{$this->column->id}"
        );

        $response->assertForbidden();
    }
}
