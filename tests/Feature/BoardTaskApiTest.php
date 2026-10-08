<?php

namespace Tests\Feature;

use App\Http\Controllers\Api\BoardTaskController;
use App\Models\Board;
use App\Models\Column;
use App\Models\Task;
use App\Models\Team;
use App\Models\TeamMember;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
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
        $this->assertArrayHasKey('gitlab_refs', $task);
        $this->assertArrayHasKey('comments_count', $task);
        $this->assertArrayHasKey('subtasks_count', $task);
    }

    public function test_all_mode_returns_every_task_without_pagination(): void
    {
        $column2 = Column::factory()->create(['board_id' => $this->board->id]);
        $this->insertTasks(70, $this->column);
        $this->insertTasks(60, $column2);

        $response = $this->actingAs($this->user)
            ->getJson(route('boards.tasks.index', [$this->team, $this->board]).'?all=1');

        $response->assertOk();
        $response->assertJsonCount(130, 'data');
        $response->assertJsonPath('total', 130);
        $response->assertJsonPath('limit', BoardTaskController::ALL_TASKS_LIMIT);
        $response->assertJsonPath('truncated', false);
        $response->assertJsonMissingPath('current_page');

        $task = $response->json('data.0');
        $this->assertArrayHasKey('assignees', $task);
        $this->assertArrayHasKey('labels', $task);
        $this->assertArrayHasKey('comments_count', $task);
        $this->assertArrayHasKey('subtasks_count', $task);
        $this->assertArrayHasKey('slug', $task);
    }

    public function test_all_mode_is_bounded_and_reports_truncation(): void
    {
        $this->insertTasks(BoardTaskController::ALL_TASKS_LIMIT + 5, $this->column);

        $response = $this->actingAs($this->user)
            ->getJson(route('boards.tasks.index', [$this->team, $this->board]).'?all=1');

        $response->assertOk();
        $response->assertJsonCount(BoardTaskController::ALL_TASKS_LIMIT, 'data');
        $response->assertJsonPath('total', BoardTaskController::ALL_TASKS_LIMIT + 5);
        $response->assertJsonPath('truncated', true);
    }

    public function test_all_mode_can_be_scoped_to_a_column(): void
    {
        $column2 = Column::factory()->create(['board_id' => $this->board->id]);
        $this->insertTasks(3, $this->column);
        $this->insertTasks(2, $column2);

        $response = $this->actingAs($this->user)
            ->getJson(route('boards.tasks.index', [$this->team, $this->board]).'?all=1&column_id='.$column2->id);

        $response->assertOk();
        $response->assertJsonCount(2, 'data');
        $response->assertJsonPath('total', 2);
    }

    public function test_all_mode_excludes_other_boards_tasks(): void
    {
        $otherBoard = Board::factory()->create(['team_id' => $this->team->id]);
        $otherColumn = Column::factory()->create(['board_id' => $otherBoard->id]);
        $this->insertTasks(2, $this->column);
        $this->insertTasks(4, $otherColumn);

        $response = $this->actingAs($this->user)
            ->getJson(route('boards.tasks.index', [$this->team, $this->board]).'?all=1');

        $response->assertOk();
        $response->assertJsonCount(2, 'data');
        $response->assertJsonPath('total', 2);
    }

    public function test_all_mode_requires_board_access(): void
    {
        $otherUser = User::factory()->create();

        $this->actingAs($otherUser)
            ->getJson(route('boards.tasks.index', [$this->team, $this->board]).'?all=1')
            ->assertForbidden();
    }

    public function test_all_mode_requires_authentication(): void
    {
        $this->getJson(route('boards.tasks.index', [$this->team, $this->board]).'?all=1')
            ->assertUnauthorized();
    }

    public function test_all_mode_rejects_non_boolean_values(): void
    {
        $this->actingAs($this->user)
            ->getJson(route('boards.tasks.index', [$this->team, $this->board]).'?all=everything')
            ->assertUnprocessable()
            ->assertJsonValidationErrors('all');
    }

    /**
     * Bulk-insert tasks directly; model factories are too slow for the
     * volumes needed to exercise the "all" cap.
     */
    private function insertTasks(int $count, Column $column): void
    {
        static $taskNumber = 0;
        $now = now();

        $rows = [];
        for ($i = 0; $i < $count; $i++) {
            $rows[] = [
                'id' => (string) Str::uuid(),
                'board_id' => $column->board_id,
                'column_id' => $column->id,
                'task_number' => ++$taskNumber,
                'title' => "Task {$taskNumber}",
                'priority' => 'none',
                'sort_order' => $i,
                'created_by' => $this->user->id,
                'created_at' => $now,
                'updated_at' => $now,
            ];
        }

        foreach (array_chunk($rows, 200) as $chunk) {
            DB::table('tasks')->insert($chunk);
        }
    }
}
