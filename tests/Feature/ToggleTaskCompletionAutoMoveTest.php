<?php

namespace Tests\Feature;

use App\Actions\Tasks\ToggleTaskCompletion;
use App\Models\Activity;
use App\Models\Board;
use App\Models\Column;
use App\Models\Task;
use App\Models\Team;
use App\Models\TeamMember;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
use Tests\TestCase;

class ToggleTaskCompletionAutoMoveTest extends TestCase
{
    use RefreshDatabase;

    private User $user;

    private Team $team;

    private Board $board;

    private Column $todoColumn;

    private Column $doneColumn;

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
        $this->board = Board::factory()->create([
            'team_id' => $this->team->id,
            'settings' => ['auto_move_to_done' => true],
        ]);
        $this->todoColumn = Column::factory()->create([
            'board_id' => $this->board->id,
            'name' => 'To Do',
            'is_done_column' => false,
            'sort_order' => 0,
        ]);
        $this->doneColumn = Column::factory()->create([
            'board_id' => $this->board->id,
            'name' => 'Done',
            'is_done_column' => true,
            'sort_order' => 10,
        ]);
    }

    public function test_completing_task_auto_moves_to_done_column(): void
    {
        Event::fake();

        $task = Task::factory()->create([
            'board_id' => $this->board->id,
            'column_id' => $this->todoColumn->id,
            'created_by' => $this->user->id,
        ]);

        $result = ToggleTaskCompletion::run($task, $this->user);

        $this->assertNotNull($result->completed_at);
        $this->assertEquals($this->doneColumn->id, $result->column_id);
    }

    public function test_auto_move_logs_moved_activity(): void
    {
        Event::fake();

        $task = Task::factory()->create([
            'board_id' => $this->board->id,
            'column_id' => $this->todoColumn->id,
            'created_by' => $this->user->id,
        ]);

        ToggleTaskCompletion::run($task, $this->user);

        $this->assertDatabaseHas('activities', [
            'task_id' => $task->id,
            'action' => 'moved',
        ]);

        $movedActivity = Activity::where('task_id', $task->id)
            ->where('action', 'moved')
            ->first();

        $this->assertTrue($movedActivity->changes['auto_moved']);
        $this->assertEquals($this->doneColumn->name, $movedActivity->changes['to_column']);
    }

    public function test_does_not_auto_move_when_setting_disabled(): void
    {
        Event::fake();

        $board = Board::factory()->create([
            'team_id' => $this->team->id,
            'settings' => ['auto_move_to_done' => false],
        ]);
        $column = Column::factory()->create([
            'board_id' => $board->id,
            'name' => 'To Do',
            'is_done_column' => false,
        ]);
        Column::factory()->create([
            'board_id' => $board->id,
            'name' => 'Done',
            'is_done_column' => true,
        ]);

        $task = Task::factory()->create([
            'board_id' => $board->id,
            'column_id' => $column->id,
            'created_by' => $this->user->id,
        ]);

        $result = ToggleTaskCompletion::run($task, $this->user);

        $this->assertNotNull($result->completed_at);
        $this->assertEquals($column->id, $result->column_id);
    }

    public function test_does_not_auto_move_when_no_done_column(): void
    {
        Event::fake();

        $board = Board::factory()->create([
            'team_id' => $this->team->id,
            'settings' => ['auto_move_to_done' => true],
        ]);
        $column = Column::factory()->create([
            'board_id' => $board->id,
            'name' => 'To Do',
            'is_done_column' => false,
        ]);

        $task = Task::factory()->create([
            'board_id' => $board->id,
            'column_id' => $column->id,
            'created_by' => $this->user->id,
        ]);

        $result = ToggleTaskCompletion::run($task, $this->user);

        $this->assertNotNull($result->completed_at);
        $this->assertEquals($column->id, $result->column_id);
    }

    public function test_does_not_move_if_already_in_done_column(): void
    {
        Event::fake();

        $task = Task::factory()->create([
            'board_id' => $this->board->id,
            'column_id' => $this->doneColumn->id,
            'created_by' => $this->user->id,
        ]);

        $result = ToggleTaskCompletion::run($task, $this->user);

        $this->assertNotNull($result->completed_at);
        $this->assertEquals($this->doneColumn->id, $result->column_id);

        // Should not have a "moved" activity since it was already in done column
        $this->assertDatabaseMissing('activities', [
            'task_id' => $task->id,
            'action' => 'moved',
        ]);
    }

    public function test_uncompleting_task_does_not_trigger_auto_move(): void
    {
        Event::fake();

        $task = Task::factory()->create([
            'board_id' => $this->board->id,
            'column_id' => $this->doneColumn->id,
            'created_by' => $this->user->id,
            'completed_at' => now(),
        ]);

        $result = ToggleTaskCompletion::run($task, $this->user);

        $this->assertNull($result->completed_at);
        // Should stay in the done column (auto-move only works on completion)
        $this->assertEquals($this->doneColumn->id, $result->column_id);
    }

    public function test_auto_move_places_task_at_end_of_done_column(): void
    {
        Event::fake();

        // Create existing tasks in done column
        Task::factory()->create([
            'board_id' => $this->board->id,
            'column_id' => $this->doneColumn->id,
            'created_by' => $this->user->id,
            'sort_order' => 10,
        ]);

        $task = Task::factory()->create([
            'board_id' => $this->board->id,
            'column_id' => $this->todoColumn->id,
            'created_by' => $this->user->id,
            'sort_order' => 1,
        ]);

        $result = ToggleTaskCompletion::run($task, $this->user);

        $this->assertEquals(11, $result->sort_order);
    }
}
