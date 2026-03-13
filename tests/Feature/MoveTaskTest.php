<?php

namespace Tests\Feature;

use App\Actions\Tasks\MoveTask;
use App\Models\Activity;
use App\Models\Board;
use App\Models\Column;
use App\Models\Task;
use App\Models\Team;
use App\Models\TeamMember;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

class MoveTaskTest extends TestCase
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
        $this->board = Board::factory()->create(['team_id' => $this->team->id]);
        $this->todoColumn = Column::factory()->create(['board_id' => $this->board->id, 'name' => 'To Do']);
        $this->doneColumn = Column::factory()->create(['board_id' => $this->board->id, 'name' => 'Done']);
    }

    public function test_move_task_between_columns(): void
    {
        Event::fake();

        $task = Task::factory()->create([
            'board_id' => $this->board->id,
            'column_id' => $this->todoColumn->id,
            'created_by' => $this->user->id,
        ]);

        $this->actingAs($this->user);
        $result = MoveTask::run($task, $this->doneColumn, 1.0);

        $this->assertEquals($this->doneColumn->id, $result->column_id);
        $this->assertDatabaseHas('activities', [
            'task_id' => $task->id,
            'action' => 'moved',
        ]);
    }

    public function test_same_column_reorder_does_not_log_activity(): void
    {
        Event::fake();

        $task = Task::factory()->create([
            'board_id' => $this->board->id,
            'column_id' => $this->todoColumn->id,
            'created_by' => $this->user->id,
            'sort_order' => 1,
        ]);

        $this->actingAs($this->user);
        MoveTask::run($task, $this->todoColumn, 5.0);

        $this->assertDatabaseMissing('activities', [
            'task_id' => $task->id,
            'action' => 'moved',
        ]);
    }

    public function test_wip_limit_prevents_move(): void
    {
        Event::fake();

        $limitedColumn = Column::factory()->create([
            'board_id' => $this->board->id,
            'name' => 'Limited',
            'wip_limit' => 1,
        ]);

        Task::factory()->create([
            'board_id' => $this->board->id,
            'column_id' => $limitedColumn->id,
            'created_by' => $this->user->id,
        ]);

        $task = Task::factory()->create([
            'board_id' => $this->board->id,
            'column_id' => $this->todoColumn->id,
            'created_by' => $this->user->id,
        ]);

        $this->actingAs($this->user);

        $this->expectException(ValidationException::class);
        MoveTask::run($task, $limitedColumn, 2.0);
    }

    public function test_wip_limit_not_enforced_within_same_column(): void
    {
        Event::fake();

        $limitedColumn = Column::factory()->create([
            'board_id' => $this->board->id,
            'name' => 'Limited',
            'wip_limit' => 1,
        ]);

        $task = Task::factory()->create([
            'board_id' => $this->board->id,
            'column_id' => $limitedColumn->id,
            'created_by' => $this->user->id,
        ]);

        $this->actingAs($this->user);

        // Reordering within same column should not trigger WIP limit
        $result = MoveTask::run($task, $limitedColumn, 5.0);
        $this->assertEquals($limitedColumn->id, $result->column_id);
    }

    public function test_wip_limit_allows_move_when_under_limit(): void
    {
        Event::fake();

        $limitedColumn = Column::factory()->create([
            'board_id' => $this->board->id,
            'name' => 'Limited',
            'wip_limit' => 3,
        ]);

        $task = Task::factory()->create([
            'board_id' => $this->board->id,
            'column_id' => $this->todoColumn->id,
            'created_by' => $this->user->id,
        ]);

        $this->actingAs($this->user);
        $result = MoveTask::run($task, $limitedColumn, 1.0);

        $this->assertEquals($limitedColumn->id, $result->column_id);
    }

    public function test_cross_board_move_reassigns_task_number(): void
    {
        Event::fake();

        $otherBoard = Board::factory()->create(['team_id' => $this->team->id]);
        $otherColumn = Column::factory()->create(['board_id' => $otherBoard->id, 'name' => 'To Do']);

        // Create a task in the other board with task_number 5
        Task::factory()->create([
            'board_id' => $otherBoard->id,
            'column_id' => $otherColumn->id,
            'created_by' => $this->user->id,
            'task_number' => 5,
        ]);

        $task = Task::factory()->create([
            'board_id' => $this->board->id,
            'column_id' => $this->todoColumn->id,
            'created_by' => $this->user->id,
            'task_number' => 1,
        ]);

        $this->actingAs($this->user);
        $result = MoveTask::run($task, $otherColumn, 1.0, $otherBoard);

        $this->assertEquals($otherBoard->id, $result->board_id);
        $this->assertEquals($otherColumn->id, $result->column_id);
        $this->assertEquals(6, $result->task_number);
    }

    public function test_cross_board_move_logs_activity_with_board_info(): void
    {
        Event::fake();

        $otherBoard = Board::factory()->create(['team_id' => $this->team->id, 'name' => 'Other Board']);
        $otherColumn = Column::factory()->create(['board_id' => $otherBoard->id, 'name' => 'Backlog']);

        $task = Task::factory()->create([
            'board_id' => $this->board->id,
            'column_id' => $this->todoColumn->id,
            'created_by' => $this->user->id,
        ]);

        $this->actingAs($this->user);
        MoveTask::run($task, $otherColumn, 1.0, $otherBoard);

        $activity = Activity::where('task_id', $task->id)
            ->where('action', 'moved')
            ->first();

        $this->assertNotNull($activity);
        $this->assertEquals($otherBoard->name, $activity->changes['to_board']);
        $this->assertEquals($this->board->name, $activity->changes['from_board']);
    }

    public function test_null_wip_limit_does_not_restrict(): void
    {
        Event::fake();

        $unlimitedColumn = Column::factory()->create([
            'board_id' => $this->board->id,
            'name' => 'Unlimited',
            'wip_limit' => null,
        ]);

        $task = Task::factory()->create([
            'board_id' => $this->board->id,
            'column_id' => $this->todoColumn->id,
            'created_by' => $this->user->id,
        ]);

        $this->actingAs($this->user);
        $result = MoveTask::run($task, $unlimitedColumn, 1.0);

        $this->assertEquals($unlimitedColumn->id, $result->column_id);
    }

    public function test_zero_wip_limit_does_not_restrict(): void
    {
        Event::fake();

        $zeroLimitColumn = Column::factory()->create([
            'board_id' => $this->board->id,
            'name' => 'Zero Limit',
            'wip_limit' => 0,
        ]);

        $task = Task::factory()->create([
            'board_id' => $this->board->id,
            'column_id' => $this->todoColumn->id,
            'created_by' => $this->user->id,
        ]);

        $this->actingAs($this->user);
        $result = MoveTask::run($task, $zeroLimitColumn, 1.0);

        $this->assertEquals($zeroLimitColumn->id, $result->column_id);
    }

    public function test_sort_order_is_updated(): void
    {
        Event::fake();

        $task = Task::factory()->create([
            'board_id' => $this->board->id,
            'column_id' => $this->todoColumn->id,
            'created_by' => $this->user->id,
            'sort_order' => 1,
        ]);

        $this->actingAs($this->user);
        $result = MoveTask::run($task, $this->doneColumn, 42.5);

        $this->assertEquals(42.5, $result->sort_order);
    }
}
