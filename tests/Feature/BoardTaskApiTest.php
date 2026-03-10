<?php

namespace Tests\Feature;

use App\Models\Board;
use App\Models\Column;
use App\Models\Task;
use App\Models\Team;
use App\Models\TeamMember;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class BoardTaskApiTest extends TestCase
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
        TeamMember::create([
            'team_id' => $this->team->id,
            'user_id' => $this->user->id,
            'role' => 'owner',
        ]);
        $this->board = Board::factory()->create(['team_id' => $this->team->id]);
        $this->column = Column::factory()->create(['board_id' => $this->board->id]);
    }

    public function test_returns_paginated_tasks(): void
    {
        // Create 5 tasks
        for ($i = 1; $i <= 5; $i++) {
            Task::factory()->create([
                'board_id' => $this->board->id,
                'column_id' => $this->column->id,
                'sort_order' => $i,
                'created_by' => $this->user->id,
            ]);
        }

        $response = $this->actingAs($this->user)
            ->getJson(route('boards.tasks.index', [$this->team, $this->board]).'?per_page=2');

        $response->assertOk();
        $response->assertJsonCount(2, 'data');
        $response->assertJsonPath('total', 5);
        $response->assertJsonPath('per_page', 2);
        $response->assertJsonPath('last_page', 3);
    }

    public function test_filters_by_column(): void
    {
        $column2 = Column::factory()->create(['board_id' => $this->board->id]);

        Task::factory()->create([
            'board_id' => $this->board->id,
            'column_id' => $this->column->id,
            'created_by' => $this->user->id,
        ]);
        Task::factory()->create([
            'board_id' => $this->board->id,
            'column_id' => $column2->id,
            'created_by' => $this->user->id,
        ]);

        $response = $this->actingAs($this->user)
            ->getJson(route('boards.tasks.index', [$this->team, $this->board]).'?column_id='.$this->column->id);

        $response->assertOk();
        $response->assertJsonCount(1, 'data');
    }

    public function test_unauthenticated_user_cannot_access(): void
    {
        $response = $this->getJson(route('boards.tasks.index', [$this->team, $this->board]));

        $response->assertUnauthorized();
    }

    public function test_non_member_cannot_access(): void
    {
        $otherUser = User::factory()->create();

        $response = $this->actingAs($otherUser)
            ->getJson(route('boards.tasks.index', [$this->team, $this->board]));

        $response->assertForbidden();
    }

    public function test_supports_sorting(): void
    {
        Task::factory()->create([
            'board_id' => $this->board->id,
            'column_id' => $this->column->id,
            'task_number' => 10,
            'created_by' => $this->user->id,
        ]);
        Task::factory()->create([
            'board_id' => $this->board->id,
            'column_id' => $this->column->id,
            'task_number' => 5,
            'created_by' => $this->user->id,
        ]);

        $response = $this->actingAs($this->user)
            ->getJson(route('boards.tasks.index', [$this->team, $this->board]).'?sort=task_number&direction=asc');

        $response->assertOk();
        $data = $response->json('data');
        $this->assertCount(2, $data);
        $this->assertEquals(5, $data[0]['task_number']);
        $this->assertEquals(10, $data[1]['task_number']);
    }

    public function test_includes_relationships(): void
    {
        Task::factory()->create([
            'board_id' => $this->board->id,
            'column_id' => $this->column->id,
            'created_by' => $this->user->id,
        ]);

        $response = $this->actingAs($this->user)
            ->getJson(route('boards.tasks.index', [$this->team, $this->board]));

        $response->assertOk();
        $task = $response->json('data.0');
        $this->assertArrayHasKey('assignees', $task);
        $this->assertArrayHasKey('labels', $task);
        $this->assertArrayHasKey('gitlab_links', $task);
        $this->assertArrayHasKey('comments_count', $task);
        $this->assertArrayHasKey('subtasks_count', $task);
    }
}
