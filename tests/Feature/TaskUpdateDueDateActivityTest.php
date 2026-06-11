<?php

namespace Tests\Feature;

use App\Actions\Tasks\UpdateTask;
use App\Models\Activity;
use App\Models\Board;
use App\Models\Column;
use App\Models\Task;
use App\Models\Team;
use App\Models\TeamMember;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class TaskUpdateDueDateActivityTest extends TestCase
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

    public function test_unchanged_due_date_logs_no_field_changed_activity(): void
    {
        $this->actingAs($this->user);

        $task = Task::factory()->create([
            'board_id' => $this->board->id,
            'column_id' => $this->column->id,
            'created_by' => $this->user->id,
            'due_date' => '2026-06-20',
        ]);

        UpdateTask::run($task, [
            'title' => $task->title,
            'due_date' => '2026-06-20',
        ]);

        $this->assertSame(
            0,
            Activity::where('task_id', $task->id)
                ->where('action', 'field_changed')
                ->count(),
        );
    }

    public function test_changed_due_date_logs_field_changed_activity(): void
    {
        $this->actingAs($this->user);

        $task = Task::factory()->create([
            'board_id' => $this->board->id,
            'column_id' => $this->column->id,
            'created_by' => $this->user->id,
            'due_date' => '2026-06-20',
        ]);

        UpdateTask::run($task, [
            'due_date' => '2026-06-25',
        ]);

        $activity = Activity::where('task_id', $task->id)
            ->where('action', 'field_changed')
            ->first();

        $this->assertNotNull($activity);
        $this->assertSame('2026-06-20', $activity->changes['due_date']['from']);
        $this->assertSame('2026-06-25', $activity->changes['due_date']['to']);
    }

    public function test_clearing_due_date_logs_field_changed_activity(): void
    {
        $this->actingAs($this->user);

        $task = Task::factory()->create([
            'board_id' => $this->board->id,
            'column_id' => $this->column->id,
            'created_by' => $this->user->id,
            'due_date' => '2026-06-20',
        ]);

        UpdateTask::run($task, ['due_date' => null]);

        $activity = Activity::where('task_id', $task->id)
            ->where('action', 'field_changed')
            ->first();

        $this->assertNotNull($activity);
        $this->assertSame('2026-06-20', $activity->changes['due_date']['from']);
        $this->assertNull($activity->changes['due_date']['to']);
    }
}
