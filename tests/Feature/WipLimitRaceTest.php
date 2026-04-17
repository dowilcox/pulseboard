<?php

namespace Tests\Feature;

use App\Actions\Tasks\CreateTask;
use App\Actions\Tasks\MoveTask;
use App\Models\Board;
use App\Models\Column;
use App\Models\Task;
use App\Models\Team;
use App\Models\TeamMember;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

class WipLimitRaceTest extends TestCase
{
    use RefreshDatabase;

    private User $user;

    private Team $team;

    private Board $board;

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
    }

    public function test_create_task_acquires_column_row_lock_before_wip_check(): void
    {
        if (DB::connection()->getDriverName() === 'sqlite') {
            $this->markTestSkipped('SQLite strips FOR UPDATE; lock emission is only observable on MySQL/Postgres.');
        }

        Event::fake();

        $column = Column::factory()->create([
            'board_id' => $this->board->id,
            'name' => 'Limited',
            'wip_limit' => 2,
        ]);

        DB::enableQueryLog();
        DB::flushQueryLog();

        CreateTask::run(
            $this->board,
            $column,
            ['title' => 'First'],
            $this->user,
        );

        $queries = collect(DB::getQueryLog())->pluck('query')->implode("\n");
        DB::disableQueryLog();

        $this->assertMatchesRegularExpression(
            '/select \* from "?columns"? where "?id"? = \?.*for update/is',
            $queries,
            'Expected a SELECT ... FOR UPDATE on the columns row to serialize WIP-bound writes.'
        );
    }

    public function test_create_task_enforces_wip_limit_when_row_inserted_after_lock(): void
    {
        Event::fake();

        $column = Column::factory()->create([
            'board_id' => $this->board->id,
            'name' => 'Limited',
            'wip_limit' => 1,
        ]);

        // Simulate a concurrent writer that slipped a row in before the transaction
        // starts. The action still needs to reject the new create because the limit
        // is already reached.
        Task::factory()->create([
            'board_id' => $this->board->id,
            'column_id' => $column->id,
            'created_by' => $this->user->id,
        ]);

        $this->expectException(ValidationException::class);

        CreateTask::run(
            $this->board,
            $column,
            ['title' => 'Should fail'],
            $this->user,
        );
    }

    public function test_move_task_acquires_column_row_lock_before_wip_check(): void
    {
        if (DB::connection()->getDriverName() === 'sqlite') {
            $this->markTestSkipped('SQLite strips FOR UPDATE; lock emission is only observable on MySQL/Postgres.');
        }

        Event::fake();

        $from = Column::factory()->create([
            'board_id' => $this->board->id,
            'name' => 'From',
        ]);

        $to = Column::factory()->create([
            'board_id' => $this->board->id,
            'name' => 'To',
            'wip_limit' => 3,
        ]);

        $task = Task::factory()->create([
            'board_id' => $this->board->id,
            'column_id' => $from->id,
            'created_by' => $this->user->id,
        ]);

        $this->actingAs($this->user);

        DB::enableQueryLog();
        DB::flushQueryLog();

        MoveTask::run($task, $to, 1.0);

        $queries = collect(DB::getQueryLog())->pluck('query')->implode("\n");
        DB::disableQueryLog();

        $this->assertMatchesRegularExpression(
            '/select \* from "?columns"? where "?id"? = \?.*for update/is',
            $queries,
            'Expected a SELECT ... FOR UPDATE on the columns row to serialize WIP-bound writes.'
        );
    }

    public function test_move_task_enforces_wip_limit_under_contention(): void
    {
        Event::fake();

        $from = Column::factory()->create([
            'board_id' => $this->board->id,
            'name' => 'From',
        ]);

        $to = Column::factory()->create([
            'board_id' => $this->board->id,
            'name' => 'Limited',
            'wip_limit' => 1,
        ]);

        // Column is already at its WIP limit from a concurrent writer
        Task::factory()->create([
            'board_id' => $this->board->id,
            'column_id' => $to->id,
            'created_by' => $this->user->id,
        ]);

        $task = Task::factory()->create([
            'board_id' => $this->board->id,
            'column_id' => $from->id,
            'created_by' => $this->user->id,
        ]);

        $this->actingAs($this->user);

        $this->expectException(ValidationException::class);

        MoveTask::run($task, $to, 1.0);
    }
}
