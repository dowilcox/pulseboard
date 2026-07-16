<?php

namespace Tests\Feature\Api\V1;

use App\Models\Board;
use App\Models\Column;
use App\Models\Task;
use App\Models\TaskDependency;
use App\Models\Team;
use App\Models\TeamMember;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class TaskDependencyApiTest extends TestCase
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

    private function makeTask(array $attributes = []): Task
    {
        return Task::factory()->create(array_merge([
            'board_id' => $this->board->id,
            'column_id' => $this->column->id,
            'created_by' => $this->user->id,
        ], $attributes));
    }

    private function dependenciesUrl(Task $task, string $suffix = ''): string
    {
        return "/api/v1/teams/{$this->team->id}/boards/{$this->board->id}/tasks/{$task->id}/dependencies{$suffix}";
    }

    public function test_add_dependency(): void
    {
        $task = $this->makeTask();
        $blocker = $this->makeTask();

        $response = $this->api()->postJson(
            $this->dependenciesUrl($task),
            ['depends_on_task_id' => $blocker->id]
        );

        $response->assertCreated();
        $response->assertJsonPath('data.task_id', $task->id);
        $response->assertJsonPath('data.depends_on_task_id', $blocker->id);
        $this->assertDatabaseHas('task_dependencies', [
            'task_id' => $task->id,
            'depends_on_task_id' => $blocker->id,
        ]);
    }

    public function test_add_dependency_across_boards_in_same_team(): void
    {
        $otherBoard = Board::factory()->create(['team_id' => $this->team->id]);
        $otherColumn = Column::factory()->create(['board_id' => $otherBoard->id]);
        $blocker = Task::factory()->create([
            'board_id' => $otherBoard->id,
            'column_id' => $otherColumn->id,
            'created_by' => $this->user->id,
        ]);
        $task = $this->makeTask();

        $response = $this->api()->postJson(
            $this->dependenciesUrl($task),
            ['depends_on_task_id' => $blocker->id]
        );

        $response->assertCreated();
        $this->assertDatabaseHas('task_dependencies', [
            'task_id' => $task->id,
            'depends_on_task_id' => $blocker->id,
        ]);
    }

    public function test_duplicate_dependency_is_rejected(): void
    {
        $task = $this->makeTask();
        $blocker = $this->makeTask();
        TaskDependency::create([
            'task_id' => $task->id,
            'depends_on_task_id' => $blocker->id,
            'created_by' => $this->user->id,
        ]);

        $response = $this->api()->postJson(
            $this->dependenciesUrl($task),
            ['depends_on_task_id' => $blocker->id]
        );

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['depends_on_task_id']);
    }

    public function test_circular_dependency_is_rejected(): void
    {
        $a = $this->makeTask();
        $b = $this->makeTask();
        TaskDependency::create([
            'task_id' => $a->id,
            'depends_on_task_id' => $b->id,
            'created_by' => $this->user->id,
        ]);

        $response = $this->api()->postJson(
            $this->dependenciesUrl($b),
            ['depends_on_task_id' => $a->id]
        );

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['depends_on_task_id']);
        $this->assertDatabaseMissing('task_dependencies', [
            'task_id' => $b->id,
            'depends_on_task_id' => $a->id,
        ]);
    }

    public function test_cross_team_dependency_is_rejected(): void
    {
        $foreignTeam = Team::factory()->create();
        $foreignBoard = Board::factory()->create(['team_id' => $foreignTeam->id]);
        $foreignColumn = Column::factory()->create(['board_id' => $foreignBoard->id]);
        $foreignTask = Task::factory()->create([
            'board_id' => $foreignBoard->id,
            'column_id' => $foreignColumn->id,
            'created_by' => $this->user->id,
        ]);
        $task = $this->makeTask();

        $response = $this->api()->postJson(
            $this->dependenciesUrl($task),
            ['depends_on_task_id' => $foreignTask->id]
        );

        $response->assertStatus(422);
        $this->assertDatabaseMissing('task_dependencies', ['task_id' => $task->id]);
    }

    public function test_remove_dependency(): void
    {
        $task = $this->makeTask();
        $blocker = $this->makeTask();
        TaskDependency::create([
            'task_id' => $task->id,
            'depends_on_task_id' => $blocker->id,
            'created_by' => $this->user->id,
        ]);

        $response = $this->api()->deleteJson($this->dependenciesUrl($task, "/{$blocker->id}"));

        $response->assertNoContent();
        $this->assertDatabaseMissing('task_dependencies', [
            'task_id' => $task->id,
            'depends_on_task_id' => $blocker->id,
        ]);
    }

    public function test_remove_dependency_with_unknown_task_returns_404(): void
    {
        $task = $this->makeTask();

        $response = $this->api()->deleteJson(
            $this->dependenciesUrl($task, '/00000000-0000-0000-0000-000000000000')
        );

        $response->assertNotFound();
    }

    public function test_dependencies_require_write_ability(): void
    {
        $readToken = $this->user->createToken('read-only', ['read'])->plainTextToken;
        $task = $this->makeTask();
        $blocker = $this->makeTask();

        $response = $this->withHeader('Authorization', "Bearer {$readToken}")
            ->postJson($this->dependenciesUrl($task), ['depends_on_task_id' => $blocker->id]);

        $response->assertForbidden();

        TaskDependency::create([
            'task_id' => $task->id,
            'depends_on_task_id' => $blocker->id,
            'created_by' => $this->user->id,
        ]);

        $response = $this->withHeader('Authorization', "Bearer {$readToken}")
            ->deleteJson($this->dependenciesUrl($task, "/{$blocker->id}"));

        $response->assertForbidden();
        $this->assertDatabaseHas('task_dependencies', [
            'task_id' => $task->id,
            'depends_on_task_id' => $blocker->id,
        ]);
    }
}
