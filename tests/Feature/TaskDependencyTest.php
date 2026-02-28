<?php

namespace Tests\Feature;

use App\Models\Board;
use App\Models\Column;
use App\Models\Task;
use App\Models\TaskDependency;
use App\Models\Team;
use App\Models\TeamMember;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class TaskDependencyTest extends TestCase
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

    private function createTask(array $attrs = []): Task
    {
        return Task::factory()->create(array_merge([
            'board_id' => $this->board->id,
            'column_id' => $this->column->id,
            'created_by' => $this->user->id,
        ], $attrs));
    }

    public function test_can_add_dependency(): void
    {
        $taskA = $this->createTask(['title' => 'Task A']);
        $taskB = $this->createTask(['title' => 'Task B']);

        $response = $this->actingAs($this->user)->post(
            route('tasks.dependencies.store', [$this->team, $this->board, $taskA]),
            ['depends_on_task_id' => $taskB->id]
        );

        $response->assertRedirect();
        $this->assertDatabaseHas('task_dependencies', [
            'task_id' => $taskA->id,
            'depends_on_task_id' => $taskB->id,
        ]);
    }

    public function test_can_remove_dependency(): void
    {
        $taskA = $this->createTask();
        $taskB = $this->createTask();

        TaskDependency::create([
            'task_id' => $taskA->id,
            'depends_on_task_id' => $taskB->id,
            'created_by' => $this->user->id,
        ]);

        $response = $this->actingAs($this->user)->delete(
            route('tasks.dependencies.destroy', [$this->team, $this->board, $taskA, $taskB])
        );

        $response->assertRedirect();
        $this->assertDatabaseMissing('task_dependencies', [
            'task_id' => $taskA->id,
            'depends_on_task_id' => $taskB->id,
        ]);
    }

    public function test_prevents_circular_dependency(): void
    {
        $taskA = $this->createTask();
        $taskB = $this->createTask();

        // A depends on B
        TaskDependency::create([
            'task_id' => $taskA->id,
            'depends_on_task_id' => $taskB->id,
            'created_by' => $this->user->id,
        ]);

        // Try to add B depends on A (circular)
        $response = $this->actingAs($this->user)->post(
            route('tasks.dependencies.store', [$this->team, $this->board, $taskB]),
            ['depends_on_task_id' => $taskA->id]
        );

        $response->assertSessionHasErrors('depends_on_task_id');
    }

    public function test_prevents_transitive_circular_dependency(): void
    {
        $taskA = $this->createTask();
        $taskB = $this->createTask();
        $taskC = $this->createTask();

        // A depends on B, B depends on C
        TaskDependency::create([
            'task_id' => $taskA->id,
            'depends_on_task_id' => $taskB->id,
            'created_by' => $this->user->id,
        ]);
        TaskDependency::create([
            'task_id' => $taskB->id,
            'depends_on_task_id' => $taskC->id,
            'created_by' => $this->user->id,
        ]);

        // Try C depends on A (transitive circular)
        $response = $this->actingAs($this->user)->post(
            route('tasks.dependencies.store', [$this->team, $this->board, $taskC]),
            ['depends_on_task_id' => $taskA->id]
        );

        $response->assertSessionHasErrors('depends_on_task_id');
    }

    public function test_dependency_relationships_on_task(): void
    {
        $taskA = $this->createTask();
        $taskB = $this->createTask();

        TaskDependency::create([
            'task_id' => $taskA->id,
            'depends_on_task_id' => $taskB->id,
            'created_by' => $this->user->id,
        ]);

        $taskA->load(['dependencies', 'blockedBy']);
        $taskB->load(['dependencies', 'blockedBy']);

        // A depends on B, so B blocks A
        $this->assertCount(1, $taskA->blockedBy);
        $this->assertEquals($taskB->id, $taskA->blockedBy->first()->id);

        // B is blocking A, so B has A as a dependency
        $this->assertCount(1, $taskB->dependencies);
        $this->assertEquals($taskA->id, $taskB->dependencies->first()->id);
    }

    public function test_prevents_duplicate_dependency(): void
    {
        $taskA = $this->createTask();
        $taskB = $this->createTask();

        TaskDependency::create([
            'task_id' => $taskA->id,
            'depends_on_task_id' => $taskB->id,
            'created_by' => $this->user->id,
        ]);

        $response = $this->actingAs($this->user)->post(
            route('tasks.dependencies.store', [$this->team, $this->board, $taskA]),
            ['depends_on_task_id' => $taskB->id]
        );

        // Should fail with unique constraint or validation
        $this->assertDatabaseCount('task_dependencies', 1);
    }
}
