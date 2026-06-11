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

class TaskDependencyCrossBoardTest extends TestCase
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
        $this->column = Column::factory()->create([
            'board_id' => $this->board->id,
        ]);
    }

    private function createTask(Board $board, Column $column, array $attrs = []): Task
    {
        return Task::factory()->create(
            array_merge(
                [
                    'board_id' => $board->id,
                    'column_id' => $column->id,
                    'created_by' => $this->user->id,
                ],
                $attrs,
            ),
        );
    }

    public function test_duplicate_dependency_returns_validation_error_not_500(): void
    {
        $taskA = $this->createTask($this->board, $this->column);
        $taskB = $this->createTask($this->board, $this->column);

        TaskDependency::create([
            'task_id' => $taskA->id,
            'depends_on_task_id' => $taskB->id,
            'created_by' => $this->user->id,
        ]);

        $response = $this->actingAs($this->user)->post(
            route('tasks.dependencies.store', [
                $this->team,
                $this->board,
                $taskA,
            ]),
            ['depends_on_task_id' => $taskB->id],
        );

        $response->assertRedirect();
        $response->assertSessionHasErrors('depends_on_task_id');
        $this->assertDatabaseCount('task_dependencies', 1);
    }

    public function test_cross_board_dependency_can_be_removed(): void
    {
        $otherBoard = Board::factory()->create(['team_id' => $this->team->id]);
        $otherColumn = Column::factory()->create(['board_id' => $otherBoard->id]);

        $taskA = $this->createTask($this->board, $this->column);
        $crossBoardTask = $this->createTask($otherBoard, $otherColumn);

        TaskDependency::create([
            'task_id' => $taskA->id,
            'depends_on_task_id' => $crossBoardTask->id,
            'created_by' => $this->user->id,
        ]);

        $response = $this->actingAs($this->user)->delete(
            route('tasks.dependencies.destroy', [
                $this->team,
                $this->board,
                $taskA,
                $crossBoardTask->id,
            ]),
        );

        $response->assertRedirect();
        $this->assertDatabaseMissing('task_dependencies', [
            'task_id' => $taskA->id,
            'depends_on_task_id' => $crossBoardTask->id,
        ]);
    }

    public function test_cross_board_blocking_dependency_can_be_removed_via_dependent_tasks_board(): void
    {
        // Removing a "Blocking" link from a task's page: the dependent task
        // (route {task}) lives on ANOTHER board, so the frontend builds the
        // URL with the dependent task's own board id and the current task's
        // UUID as {dependsOnTask}.
        $otherBoard = Board::factory()->create(['team_id' => $this->team->id]);
        $otherColumn = Column::factory()->create(['board_id' => $otherBoard->id]);

        $currentTask = $this->createTask($this->board, $this->column);
        $dependentTask = $this->createTask($otherBoard, $otherColumn);

        TaskDependency::create([
            'task_id' => $dependentTask->id,
            'depends_on_task_id' => $currentTask->id,
            'created_by' => $this->user->id,
        ]);

        $response = $this->actingAs($this->user)->delete(
            route('tasks.dependencies.destroy', [
                $this->team,
                $otherBoard->id,
                $dependentTask->slug ?? $dependentTask->id,
                $currentTask->id,
            ]),
        );

        $response->assertRedirect();
        $this->assertDatabaseMissing('task_dependencies', [
            'task_id' => $dependentTask->id,
            'depends_on_task_id' => $currentTask->id,
        ]);
    }

    public function test_dependency_on_other_team_task_cannot_be_removed(): void
    {
        $otherTeam = Team::factory()->create();
        $otherBoard = Board::factory()->create(['team_id' => $otherTeam->id]);
        $otherColumn = Column::factory()->create(['board_id' => $otherBoard->id]);

        $taskA = $this->createTask($this->board, $this->column);
        $foreignTask = Task::factory()->create([
            'board_id' => $otherBoard->id,
            'column_id' => $otherColumn->id,
        ]);

        $response = $this->actingAs($this->user)->delete(
            route('tasks.dependencies.destroy', [
                $this->team,
                $this->board,
                $taskA,
                $foreignTask->id,
            ]),
        );

        $response->assertNotFound();
    }

    public function test_same_board_dependency_can_still_be_removed_by_slug(): void
    {
        $taskA = $this->createTask($this->board, $this->column);
        $taskB = $this->createTask($this->board, $this->column);

        TaskDependency::create([
            'task_id' => $taskA->id,
            'depends_on_task_id' => $taskB->id,
            'created_by' => $this->user->id,
        ]);

        $response = $this->actingAs($this->user)->delete(
            route('tasks.dependencies.destroy', [
                $this->team,
                $this->board,
                $taskA,
                $taskB,
            ]),
        );

        $response->assertRedirect();
        $this->assertDatabaseMissing('task_dependencies', [
            'task_id' => $taskA->id,
            'depends_on_task_id' => $taskB->id,
        ]);
    }
}
