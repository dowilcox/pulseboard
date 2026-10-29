<?php

namespace Tests\Feature;

use App\Models\Board;
use App\Models\Column;
use App\Models\Label;
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

    public function test_recurring_task_with_deleted_creator_is_attributed_to_a_team_owner(): void
    {
        $formerMember = User::factory()->create();
        TeamMember::create([
            'team_id' => $this->team->id,
            'user_id' => $formerMember->id,
            'role' => 'member',
        ]);
        $task = Task::factory()->create([
            'board_id' => $this->board->id,
            'column_id' => $this->column->id,
            'created_by' => $formerMember->id,
            'title' => 'Weekly report',
            'recurrence_config' => ['frequency' => 'daily', 'interval' => 1],
            'recurrence_next_at' => now()->subHour(),
        ]);

        $formerMember->delete();
        $this->assertNull($task->fresh()->created_by);

        $this->artisan('tasks:process-recurring')->assertSuccessful();

        $copy = Task::where('title', 'Weekly report')->whereKeyNot($task->id)->sole();
        $this->assertSame($this->user->id, $copy->created_by);
        $this->assertTrue($task->fresh()->recurrence_next_at->isFuture());
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

    public function test_overdue_recurring_task_creates_single_copy_and_skips_forward(): void
    {
        $task = Task::factory()->create([
            'board_id' => $this->board->id,
            'column_id' => $this->column->id,
            'created_by' => $this->user->id,
            'title' => 'Backlogged daily',
            'recurrence_config' => ['frequency' => 'daily', 'interval' => 1],
            'recurrence_next_at' => now()->subDays(5),
        ]);

        $this->artisan('tasks:process-recurring')
            ->assertSuccessful();

        $this->assertDatabaseCount('tasks', 2);

        $task->refresh();
        $this->assertTrue($task->recurrence_next_at->isFuture());
    }

    public function test_recurring_task_command_filters_deactivated_assignees_and_copies_metadata(): void
    {
        $activeAssignee = User::factory()->create();
        $inactiveAssignee = User::factory()->create(['deactivated_at' => now()]);
        $label = Label::factory()->create(['team_id' => $this->team->id]);

        TeamMember::create([
            'team_id' => $this->team->id,
            'user_id' => $activeAssignee->id,
            'role' => 'member',
        ]);
        TeamMember::create([
            'team_id' => $this->team->id,
            'user_id' => $inactiveAssignee->id,
            'role' => 'member',
        ]);

        $task = Task::factory()->create([
            'board_id' => $this->board->id,
            'column_id' => $this->column->id,
            'created_by' => $this->user->id,
            'title' => 'Recurring with metadata',
            'checklists' => [[
                'id' => 'checklist-1',
                'title' => 'Prep',
                'items' => [[
                    'id' => 'item-1',
                    'text' => 'Review docs',
                    'completed' => false,
                ]],
            ]],
            'recurrence_config' => ['frequency' => 'daily', 'interval' => 1],
            'recurrence_next_at' => now()->subHour(),
        ]);

        $task->assignees()->attach([
            $activeAssignee->id => [
                'assigned_at' => now(),
                'assigned_by' => $this->user->id,
            ],
            $inactiveAssignee->id => [
                'assigned_at' => now(),
                'assigned_by' => $this->user->id,
            ],
        ]);
        $task->labels()->attach($label->id);

        $this->artisan('tasks:process-recurring')
            ->assertSuccessful();

        $newTask = Task::query()
            ->where('id', '!=', $task->id)
            ->latest('created_at')
            ->firstOrFail();

        $this->assertTrue($newTask->assignees()->where('users.id', $activeAssignee->id)->exists());
        $this->assertFalse($newTask->assignees()->where('users.id', $inactiveAssignee->id)->exists());
        $this->assertTrue($newTask->labels()->where('labels.id', $label->id)->exists());
        $this->assertEquals($task->checklists, $newTask->checklists);
    }

    private function recurringTask(array $attributes = []): Task
    {
        return Task::factory()->create(array_merge([
            'board_id' => $this->board->id,
            'column_id' => $this->column->id,
            'created_by' => $this->user->id,
            'due_date' => null,
        ], $attributes));
    }

    private function saveRecurrence(Task $task, array $data)
    {
        return $this->actingAs($this->user)->put(
            route('tasks.update', [$this->team, $this->board, $task]),
            $data,
        );
    }

    public function test_first_occurrence_is_anchored_on_the_due_date(): void
    {
        $this->travelTo('2026-10-28 15:00:00');
        $task = $this->recurringTask(['due_date' => '2026-11-06']);

        $this->saveRecurrence($task, [
            'recurrence_config' => ['frequency' => 'weekly', 'interval' => 1],
        ])->assertRedirect();

        $task->refresh();
        $this->assertSame('2026-11-13 00:00:00', $task->recurrence_next_at->toDateTimeString());
        // assertEquals: MySQL JSON columns don't keep key order.
        $this->assertEquals(['frequency' => 'weekly', 'interval' => 1], $task->recurrence_config);
    }

    public function test_without_a_due_date_the_first_occurrence_counts_from_today(): void
    {
        $this->travelTo('2026-10-28 15:00:00');
        $task = $this->recurringTask();

        $this->saveRecurrence($task, [
            'recurrence_config' => ['frequency' => 'weekly', 'interval' => 1, 'days_of_week' => [1, 5]],
        ])->assertRedirect();

        $task->refresh();
        // Friday 10-30 is the first selected weekday after Wednesday 10-28.
        $this->assertSame('2026-10-30 00:00:00', $task->recurrence_next_at->toDateTimeString());
        $this->assertSame('2026-10-28', $task->recurrence_config['anchor_date']);
    }

    public function test_changing_the_due_date_reschedules_a_recurring_task(): void
    {
        $this->travelTo('2026-10-28 15:00:00');
        $task = $this->recurringTask(['due_date' => '2026-11-06']);
        $this->saveRecurrence($task, ['recurrence_config' => ['frequency' => 'monthly', 'interval' => 1]]);

        $this->saveRecurrence($task, ['due_date' => '2026-11-20'])->assertRedirect();

        $this->assertSame('2026-12-20', $task->refresh()->recurrence_next_at->toDateString());
    }

    public function test_resaving_an_unchanged_rule_keeps_the_schedule(): void
    {
        $this->travelTo('2026-10-28 15:00:00');
        $task = $this->recurringTask();
        $this->saveRecurrence($task, ['recurrence_config' => ['frequency' => 'daily', 'interval' => 3]]);

        $this->travelTo('2026-10-29 09:00:00');
        $this->saveRecurrence($task, [
            'recurrence_config' => ['frequency' => 'daily', 'interval' => 3, 'anchor_date' => '2026-10-28'],
        ])->assertRedirect();

        $task->refresh();
        $this->assertSame('2026-10-31', $task->recurrence_next_at->toDateString());
        $this->assertSame('2026-10-28', $task->recurrence_config['anchor_date']);
    }

    public function test_recurrence_config_shape_is_validated(): void
    {
        $task = $this->recurringTask();

        $invalid = [
            ['frequency' => 'yearly', 'interval' => 1],
            ['frequency' => 'daily', 'interval' => 0],
            ['frequency' => 'daily', 'interval' => 366],
            ['frequency' => 'weekly', 'interval' => 1, 'days_of_week' => [7]],
            ['frequency' => 'weekly', 'interval' => 1, 'days_of_week' => [1, 1]],
            ['frequency' => 'weekly', 'interval' => 1, 'days_of_week' => 'monday'],
            ['frequency' => 'monthly', 'interval' => 1, 'day_of_month' => 32],
            ['frequency' => 'monthly', 'interval' => 1, 'day_of_month' => 0],
            ['frequency' => 'daily', 'interval' => 1, 'end_date' => 'next week'],
        ];

        foreach ($invalid as $config) {
            $this->saveRecurrence($task, ['recurrence_config' => $config])
                ->assertSessionHasErrors();
        }

        $this->assertNull($task->refresh()->recurrence_config);
    }

    public function test_copies_are_due_on_their_occurrence(): void
    {
        $this->travelTo('2026-10-28 15:00:00');
        $task = $this->recurringTask(['title' => 'Weekly report', 'due_date' => '2026-10-30']);
        $this->saveRecurrence($task, ['recurrence_config' => ['frequency' => 'weekly', 'interval' => 1]]);
        $this->assertSame('2026-11-06', $task->refresh()->recurrence_next_at->toDateString());

        $this->travelTo('2026-11-06 00:00:30');
        $this->artisan('tasks:process-recurring')->assertSuccessful();

        $copy = Task::where('id', '!=', $task->id)->sole();
        $this->assertSame('2026-11-06', $copy->due_date->toDateString());
        $this->assertNull($copy->recurrence_config);

        $task->refresh();
        $this->assertSame('2026-10-30', $task->due_date->toDateString());
        $this->assertSame('2026-11-13', $task->recurrence_next_at->toDateString());
    }

    public function test_copies_of_a_task_without_a_due_date_have_none(): void
    {
        $this->travelTo('2026-10-28 15:00:00');
        $task = $this->recurringTask();
        $this->saveRecurrence($task, ['recurrence_config' => ['frequency' => 'daily', 'interval' => 1]]);

        $this->travelTo('2026-10-29 00:00:30');
        $this->artisan('tasks:process-recurring')->assertSuccessful();

        $this->assertNull(Task::where('id', '!=', $task->id)->sole()->due_date);
        $this->assertSame('2026-10-30', $task->refresh()->recurrence_next_at->toDateString());
    }

    public function test_weekday_schedule_is_followed_by_the_command(): void
    {
        $this->travelTo('2026-10-28 15:00:00');
        $task = $this->recurringTask();
        $this->saveRecurrence($task, [
            'recurrence_config' => ['frequency' => 'weekly', 'interval' => 1, 'days_of_week' => [1, 5]],
        ]);

        $created = [];
        foreach (['2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02', '2026-11-03'] as $day) {
            $this->travelTo("{$day} 00:00:30");
            $before = Task::count();
            $this->artisan('tasks:process-recurring')->assertSuccessful();
            if (Task::count() > $before) {
                $created[] = $day;
            }
        }

        // Friday and Monday only.
        $this->assertSame(['2026-10-30', '2026-11-02'], $created);
    }

    public function test_missed_runs_create_one_copy_for_the_latest_occurrence(): void
    {
        $this->travelTo('2026-10-28 15:00:00');
        $task = $this->recurringTask(['due_date' => '2026-10-28']);
        $this->saveRecurrence($task, ['recurrence_config' => ['frequency' => 'daily', 'interval' => 1]]);

        $this->travelTo('2026-11-02 08:00:00');
        $this->artisan('tasks:process-recurring')->assertSuccessful();

        $copy = Task::where('id', '!=', $task->id)->sole();
        $this->assertSame('2026-11-02', $copy->due_date->toDateString());
        $this->assertSame('2026-11-03', $task->refresh()->recurrence_next_at->toDateString());
    }

    public function test_recurrence_stops_after_the_end_date(): void
    {
        $this->travelTo('2026-10-28 15:00:00');
        $task = $this->recurringTask();
        $this->saveRecurrence($task, [
            'recurrence_config' => ['frequency' => 'daily', 'interval' => 1, 'end_date' => '2026-10-30'],
        ]);

        foreach (['2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01'] as $day) {
            $this->travelTo("{$day} 00:00:30");
            $this->artisan('tasks:process-recurring')->assertSuccessful();
        }

        $this->assertSame(3, Task::count());
        $task->refresh();
        $this->assertNull($task->recurrence_next_at);
        $this->assertSame('2026-10-30', $task->recurrence_config['end_date']);
    }

    public function test_legacy_config_without_anchor_keeps_its_phase(): void
    {
        $this->travelTo('2026-10-28 00:00:30');
        // Saved by the old code: next occurrence at save time + interval, no anchor.
        $task = $this->recurringTask([
            'recurrence_config' => ['frequency' => 'daily', 'interval' => 2],
            'recurrence_next_at' => '2026-10-27 14:32:00',
        ]);

        $this->artisan('tasks:process-recurring')->assertSuccessful();

        $task->refresh();
        $this->assertSame(2, Task::count());
        $this->assertSame('2026-10-29', $task->recurrence_next_at->toDateString());
        $this->assertSame('2026-10-27', $task->recurrence_config['anchor_date']);
    }
}
