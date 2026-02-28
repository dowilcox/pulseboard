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

class RecurringTaskTest extends TestCase
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

    public function test_can_set_recurrence_config(): void
    {
        $task = Task::factory()->create([
            'board_id' => $this->board->id,
            'column_id' => $this->column->id,
            'created_by' => $this->user->id,
        ]);

        $response = $this->actingAs($this->user)->put(
            route('tasks.update', [$this->team, $this->board, $task]),
            [
                'recurrence_config' => [
                    'frequency' => 'weekly',
                    'interval' => 1,
                    'days_of_week' => [1, 3, 5],
                ],
            ]
        );

        $response->assertRedirect();
        $task->refresh();
        $this->assertNotNull($task->recurrence_config);
        $this->assertEquals('weekly', $task->recurrence_config['frequency']);
        $this->assertNotNull($task->recurrence_next_at);
    }

    public function test_can_clear_recurrence_config(): void
    {
        $task = Task::factory()->create([
            'board_id' => $this->board->id,
            'column_id' => $this->column->id,
            'created_by' => $this->user->id,
            'recurrence_config' => ['frequency' => 'daily', 'interval' => 1],
            'recurrence_next_at' => now()->addDay(),
        ]);

        $response = $this->actingAs($this->user)->put(
            route('tasks.update', [$this->team, $this->board, $task]),
            ['recurrence_config' => null]
        );

        $response->assertRedirect();
        $task->refresh();
        $this->assertNull($task->recurrence_config);
        $this->assertNull($task->recurrence_next_at);
    }

    public function test_recurring_task_command_creates_new_tasks(): void
    {
        $task = Task::factory()->create([
            'board_id' => $this->board->id,
            'column_id' => $this->column->id,
            'created_by' => $this->user->id,
            'title' => 'Daily standup',
            'recurrence_config' => ['frequency' => 'daily', 'interval' => 1],
            'recurrence_next_at' => now()->subHour(),
        ]);

        $this->artisan('tasks:process-recurring')
            ->assertSuccessful();

        // Should have created a new task
        $this->assertDatabaseCount('tasks', 2);
        $this->assertDatabaseHas('tasks', [
            'title' => 'Daily standup',
            'column_id' => $this->column->id,
        ]);

        // Original task should have advanced recurrence_next_at
        $task->refresh();
        $this->assertTrue($task->recurrence_next_at->isFuture());
    }

    public function test_recurring_command_skips_tasks_not_yet_due(): void
    {
        Task::factory()->create([
            'board_id' => $this->board->id,
            'column_id' => $this->column->id,
            'created_by' => $this->user->id,
            'recurrence_config' => ['frequency' => 'daily', 'interval' => 1],
            'recurrence_next_at' => now()->addDay(),
        ]);

        $this->artisan('tasks:process-recurring')
            ->assertSuccessful();

        $this->assertDatabaseCount('tasks', 1);
    }
}
