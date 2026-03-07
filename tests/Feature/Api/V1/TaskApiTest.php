<?php

namespace Tests\Feature\Api\V1;

use App\Models\Board;
use App\Models\Column;
use App\Models\Comment;
use App\Models\Label;
use App\Models\Task;
use App\Models\Team;
use App\Models\TeamMember;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class TaskApiTest extends TestCase
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
        $this->column = Column::factory()->create(['board_id' => $this->board->id]);
        $this->token = $this->user->createToken('test', ['read', 'write'])->plainTextToken;
    }

    private function api(): static
    {
        return $this->withHeader('Authorization', "Bearer {$this->token}");
    }

    public function test_list_tasks(): void
    {
        Task::factory()->count(3)->create([
            'board_id' => $this->board->id,
            'column_id' => $this->column->id,
            'created_by' => $this->user->id,
        ]);

        $response = $this->api()->getJson("/api/v1/teams/{$this->team->id}/boards/{$this->board->id}/tasks");

        $response->assertOk();
        $response->assertJsonCount(3, 'data');
    }

    public function test_show_task(): void
    {
        $task = Task::factory()->create([
            'board_id' => $this->board->id,
            'column_id' => $this->column->id,
            'created_by' => $this->user->id,
        ]);

        $response = $this->api()->getJson("/api/v1/teams/{$this->team->id}/boards/{$this->board->id}/tasks/{$task->id}");

        $response->assertOk();
        $response->assertJsonPath('data.id', $task->id);
        $response->assertJsonStructure(['data' => ['id', 'title', 'assignees', 'labels', 'comments', 'column']]);
    }

    public function test_create_task(): void
    {
        $response = $this->api()->postJson(
            "/api/v1/teams/{$this->team->id}/boards/{$this->board->id}/columns/{$this->column->id}/tasks",
            ['title' => 'API Task', 'priority' => 'high']
        );

        $response->assertCreated();
        $response->assertJsonPath('data.title', 'API Task');
        $response->assertJsonPath('data.priority', 'high');
        $this->assertDatabaseHas('tasks', ['title' => 'API Task', 'board_id' => $this->board->id]);
    }

    public function test_update_task(): void
    {
        $task = Task::factory()->create([
            'board_id' => $this->board->id,
            'column_id' => $this->column->id,
            'created_by' => $this->user->id,
        ]);

        $response = $this->api()->putJson(
            "/api/v1/teams/{$this->team->id}/boards/{$this->board->id}/tasks/{$task->id}",
            ['title' => 'Updated Title', 'priority' => 'urgent']
        );

        $response->assertOk();
        $response->assertJsonPath('data.title', 'Updated Title');
        $response->assertJsonPath('data.priority', 'urgent');
    }

    public function test_move_task(): void
    {
        $task = Task::factory()->create([
            'board_id' => $this->board->id,
            'column_id' => $this->column->id,
            'created_by' => $this->user->id,
        ]);
        $column2 = Column::factory()->create(['board_id' => $this->board->id]);

        $response = $this->api()->patchJson(
            "/api/v1/teams/{$this->team->id}/boards/{$this->board->id}/tasks/{$task->id}/move",
            ['column_id' => $column2->id, 'sort_order' => 1]
        );

        $response->assertOk();
        $this->assertEquals($column2->id, $task->fresh()->column_id);
    }

    public function test_complete_task(): void
    {
        $task = Task::factory()->create([
            'board_id' => $this->board->id,
            'column_id' => $this->column->id,
            'created_by' => $this->user->id,
        ]);

        $response = $this->api()->patchJson(
            "/api/v1/teams/{$this->team->id}/boards/{$this->board->id}/tasks/{$task->id}/complete"
        );

        $response->assertOk();
        $this->assertNotNull($task->fresh()->completed_at);
    }

    public function test_set_assignees(): void
    {
        $task = Task::factory()->create([
            'board_id' => $this->board->id,
            'column_id' => $this->column->id,
            'created_by' => $this->user->id,
        ]);

        $response = $this->api()->putJson(
            "/api/v1/teams/{$this->team->id}/boards/{$this->board->id}/tasks/{$task->id}/assignees",
            ['user_ids' => [$this->user->id]]
        );

        $response->assertOk();
        $this->assertTrue($task->fresh()->assignees->contains($this->user));
    }

    public function test_set_labels(): void
    {
        $task = Task::factory()->create([
            'board_id' => $this->board->id,
            'column_id' => $this->column->id,
            'created_by' => $this->user->id,
        ]);
        $label = Label::factory()->create(['team_id' => $this->team->id]);

        $response = $this->api()->putJson(
            "/api/v1/teams/{$this->team->id}/boards/{$this->board->id}/tasks/{$task->id}/labels",
            ['label_ids' => [$label->id]]
        );

        $response->assertOk();
        $this->assertTrue($task->fresh()->labels->contains($label));
    }

    public function test_list_comments(): void
    {
        $task = Task::factory()->create([
            'board_id' => $this->board->id,
            'column_id' => $this->column->id,
            'created_by' => $this->user->id,
        ]);
        Comment::factory()->count(2)->create(['task_id' => $task->id, 'user_id' => $this->user->id]);

        $response = $this->api()->getJson(
            "/api/v1/teams/{$this->team->id}/boards/{$this->board->id}/tasks/{$task->id}/comments"
        );

        $response->assertOk();
        $response->assertJsonCount(2, 'data');
    }

    public function test_create_comment(): void
    {
        $task = Task::factory()->create([
            'board_id' => $this->board->id,
            'column_id' => $this->column->id,
            'created_by' => $this->user->id,
        ]);

        $response = $this->api()->postJson(
            "/api/v1/teams/{$this->team->id}/boards/{$this->board->id}/tasks/{$task->id}/comments",
            ['body' => 'Hello from API']
        );

        $response->assertCreated();
        $response->assertJsonPath('data.body', 'Hello from API');
        $this->assertDatabaseHas('comments', ['body' => 'Hello from API', 'task_id' => $task->id]);
    }

    public function test_my_tasks(): void
    {
        $task = Task::factory()->create([
            'board_id' => $this->board->id,
            'column_id' => $this->column->id,
            'created_by' => $this->user->id,
        ]);
        $task->assignees()->attach($this->user->id, ['assigned_at' => now(), 'assigned_by' => $this->user->id]);

        $response = $this->api()->getJson('/api/v1/me/tasks');

        $response->assertOk();
        $response->assertJsonCount(1, 'data');
        $response->assertJsonPath('data.0.id', $task->id);
    }

    public function test_filter_tasks_by_status(): void
    {
        Task::factory()->create([
            'board_id' => $this->board->id,
            'column_id' => $this->column->id,
            'created_by' => $this->user->id,
            'completed_at' => null,
        ]);
        Task::factory()->create([
            'board_id' => $this->board->id,
            'column_id' => $this->column->id,
            'created_by' => $this->user->id,
            'completed_at' => now(),
        ]);

        $response = $this->api()->getJson(
            "/api/v1/teams/{$this->team->id}/boards/{$this->board->id}/tasks?status=open"
        );

        $response->assertOk();
        $response->assertJsonCount(1, 'data');
    }
}
