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

class ToggleTaskCompletionTest extends TestCase
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

    public function test_can_complete_a_task(): void
    {
        $task = Task::factory()->create([
            'board_id' => $this->board->id,
            'column_id' => $this->column->id,
            'created_by' => $this->user->id,
        ]);

        $response = $this->actingAs($this->user)->patch(
            route('tasks.toggle-complete', [$this->team, $this->board, $task])
        );

        $response->assertRedirect();
        $task->refresh();
        $this->assertNotNull($task->completed_at);
    }

    public function test_can_uncomplete_a_task(): void
    {
        $task = Task::factory()->create([
            'board_id' => $this->board->id,
            'column_id' => $this->column->id,
            'created_by' => $this->user->id,
            'completed_at' => now(),
        ]);

        $response = $this->actingAs($this->user)->patch(
            route('tasks.toggle-complete', [$this->team, $this->board, $task])
        );

        $response->assertRedirect();
        $task->refresh();
        $this->assertNull($task->completed_at);
    }

    public function test_toggle_logs_activity(): void
    {
        $task = Task::factory()->create([
            'board_id' => $this->board->id,
            'column_id' => $this->column->id,
            'created_by' => $this->user->id,
        ]);

        $this->actingAs($this->user)->patch(
            route('tasks.toggle-complete', [$this->team, $this->board, $task])
        );

        $this->assertDatabaseHas('activities', [
            'task_id' => $task->id,
            'user_id' => $this->user->id,
            'action' => 'completed',
        ]);
    }

    public function test_completed_subtasks_count_works(): void
    {
        $parent = Task::factory()->create([
            'board_id' => $this->board->id,
            'column_id' => $this->column->id,
            'created_by' => $this->user->id,
        ]);

        Task::factory()->create([
            'board_id' => $this->board->id,
            'column_id' => $this->column->id,
            'created_by' => $this->user->id,
            'parent_task_id' => $parent->id,
            'completed_at' => now(),
        ]);

        Task::factory()->create([
            'board_id' => $this->board->id,
            'column_id' => $this->column->id,
            'created_by' => $this->user->id,
            'parent_task_id' => $parent->id,
        ]);

        $parent->loadCount([
            'subtasks',
            'subtasks as completed_subtasks_count' => fn ($q) => $q->whereNotNull('completed_at'),
        ]);

        $this->assertEquals(2, $parent->subtasks_count);
        $this->assertEquals(1, $parent->completed_subtasks_count);
    }
}
