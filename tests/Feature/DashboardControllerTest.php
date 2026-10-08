<?php

namespace Tests\Feature;

use App\Models\Activity;
use App\Models\Board;
use App\Models\Column;
use App\Models\Task;
use App\Models\Team;
use App\Models\TeamMember;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Inertia\Testing\AssertableInertia;
use Tests\TestCase;

class DashboardControllerTest extends TestCase
{
    use RefreshDatabase;

    private User $user;

    private Team $team;

    private Board $board;

    private Column $todo;

    private Column $done;

    protected function setUp(): void
    {
        parent::setUp();

        $this->travelTo(Carbon::parse('2026-10-08 12:00:00'));

        $this->user = User::factory()->create();
        $this->team = Team::factory()->create();
        $this->addMember($this->team, $this->user);

        $this->board = Board::factory()->create(['team_id' => $this->team->id]);
        $this->todo = Column::factory()->create([
            'board_id' => $this->board->id,
            'name' => 'To Do',
            'is_done_column' => false,
        ]);
        $this->done = Column::factory()->create([
            'board_id' => $this->board->id,
            'name' => 'Done',
            'is_done_column' => true,
        ]);
    }

    private function addMember(Team $team, User $user, string $role = 'owner'): void
    {
        TeamMember::create([
            'team_id' => $team->id,
            'user_id' => $user->id,
            'role' => $role,
        ]);
    }

    private function task(array $attributes = [], ?User $assignee = null): Task
    {
        $task = Task::factory()->create(array_merge([
            'board_id' => $this->board->id,
            'column_id' => $this->todo->id,
            'created_by' => $this->user->id,
            'due_date' => null,
            'completed_at' => null,
        ], $attributes));

        if ($assignee) {
            $task->assignees()->attach($assignee->id, [
                'assigned_at' => now(),
                'assigned_by' => $assignee->id,
            ]);
        }

        return $task;
    }

    private function props(): array
    {
        return $this->actingAs($this->user)
            ->get(route('dashboard'))
            ->assertOk()
            ->inertiaProps();
    }

    public function test_stats_count_open_overdue_due_soon_and_completed_tasks(): void
    {
        $me = $this->user;

        $this->task([], $me); // open, no due date
        $this->task(['due_date' => '2026-10-07'], $me); // overdue
        $this->task(['due_date' => '2026-10-08'], $me); // due today: not overdue
        $this->task(['due_date' => '2026-10-15'], $me); // 7 days out
        $this->task(['due_date' => '2026-10-16'], $me); // 8 days out
        $this->task(['column_id' => $this->done->id, 'due_date' => '2026-10-01'], $me); // in done column
        $this->task(['completed_at' => now()->subDays(2), 'due_date' => '2026-10-01'], $me);
        $this->task(['completed_at' => now()->subDays(10)], $me);
        $this->task(['due_date' => '2026-10-01']); // not assigned to me

        $this->actingAs($me)
            ->get(route('dashboard'))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('Dashboard')
                ->where('stats.open', 5)
                ->where('stats.overdue', 1)
                ->where('stats.due_next_7_days', 2)
                ->where('stats.completed_last_7_days', 1)
                ->where('stats.completed_previous_7_days', 1)
                ->has('myTasks', 5));
    }

    public function test_completed_window_is_based_on_completed_at(): void
    {
        $me = $this->user;

        $this->task(['completed_at' => now()->subDays(7)->addMinute()], $me);
        $this->task(['completed_at' => now()->subDays(7)->subMinute()], $me);
        $this->task(['completed_at' => now()->subDays(14)->addMinute()], $me);
        $this->task(['completed_at' => now()->subDays(15)], $me);
        // Completed recently but not by/for me.
        $this->task(['completed_at' => now()->subDay()]);

        $this->actingAs($me)
            ->get(route('dashboard'))
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->where('stats.completed_last_7_days', 1)
                ->where('stats.completed_previous_7_days', 2));
    }

    public function test_excludes_archived_boards_and_teams_the_user_is_not_in(): void
    {
        $me = $this->user;

        $archived = Board::factory()->create([
            'team_id' => $this->team->id,
            'is_archived' => true,
        ]);
        $archivedColumn = Column::factory()->create(['board_id' => $archived->id]);
        $this->task([
            'board_id' => $archived->id,
            'column_id' => $archivedColumn->id,
            'due_date' => '2026-10-01',
        ], $me);

        $otherTeam = Team::factory()->create();
        $otherBoard = Board::factory()->create(['team_id' => $otherTeam->id]);
        $otherColumn = Column::factory()->create(['board_id' => $otherBoard->id]);
        $foreign = $this->task([
            'board_id' => $otherBoard->id,
            'column_id' => $otherColumn->id,
            'due_date' => '2026-10-01',
        ], $me);
        Activity::create([
            'task_id' => $foreign->id,
            'user_id' => $me->id,
            'action' => 'created',
            'created_at' => now(),
        ]);

        $visible = $this->task([], $me);

        $props = $this->props();

        $this->assertSame(1, $props['stats']['open']);
        $this->assertSame(0, $props['stats']['overdue']);
        $this->assertSame([$visible->id], array_column($props['myTasks'], 'id'));
        $this->assertSame([$this->board->id], array_column($props['boards'], 'id'));
        $this->assertSame([], $props['recentActivity']);
    }

    public function test_boards_include_counts_and_progress_for_every_team(): void
    {
        $me = $this->user;
        $teammate = User::factory()->create();

        $this->task(['completed_at' => now()->subDay(), 'column_id' => $this->done->id], $me);
        $this->task(['column_id' => $this->done->id]); // done by column
        $this->task([], $me); // my open
        $this->task([], $teammate); // someone else's open

        $secondTeam = Team::factory()->create();
        $this->addMember($secondTeam, $me, 'member');
        $emptyBoard = Board::factory()->create(['team_id' => $secondTeam->id]);

        $props = $this->props();
        $boards = collect($props['boards'])->keyBy('id');

        $this->assertCount(2, $boards);

        $main = $boards[$this->board->id];
        $this->assertSame(4, $main['total_tasks']);
        $this->assertSame(2, $main['done_tasks']);
        $this->assertSame(2, $main['open_tasks']);
        $this->assertSame(1, $main['my_open_tasks']);
        $this->assertSame($this->team->slug, $main['team']['slug']);

        $empty = $boards[$emptyBoard->id];
        $this->assertSame(0, $empty['total_tasks']);
        $this->assertSame(0, $empty['my_open_tasks']);
        $this->assertSame($secondTeam->name, $empty['team']['name']);
    }

    public function test_boards_are_ordered_by_most_recent_activity(): void
    {
        $quiet = Board::factory()->create([
            'team_id' => $this->team->id,
            'updated_at' => now()->subMonth(),
        ]);
        $this->board->forceFill(['updated_at' => now()->subMonth()])->save();
        $busy = Board::factory()->create([
            'team_id' => $this->team->id,
            'updated_at' => now()->subMonth(),
        ]);
        $busyColumn = Column::factory()->create(['board_id' => $busy->id]);
        $busyTask = $this->task(['board_id' => $busy->id, 'column_id' => $busyColumn->id]);
        $busyTask->forceFill(['updated_at' => now()->subMonth()])->save();
        $mainTask = $this->task();
        $mainTask->forceFill(['updated_at' => now()->subMonth()])->save();

        Activity::create([
            'task_id' => $mainTask->id,
            'user_id' => $this->user->id,
            'action' => 'created',
            'created_at' => now()->subDays(3),
        ]);
        Activity::create([
            'task_id' => $busyTask->id,
            'user_id' => $this->user->id,
            'action' => 'created',
            'created_at' => now()->subHour(),
        ]);

        $props = $this->props();

        $this->assertSame(
            [$busy->id, $this->board->id, $quiet->id],
            array_column($props['boards'], 'id'),
        );
    }

    public function test_recent_activity_lists_latest_entries_with_trimmed_changes(): void
    {
        $teammate = User::factory()->create(['name' => 'Bea Teammate']);
        $this->addMember($this->team, $teammate, 'member');
        $task = $this->task(['title' => 'Ship the dashboard']);

        for ($i = 10; $i >= 1; $i--) {
            Activity::create([
                'task_id' => $task->id,
                'user_id' => $teammate->id,
                'action' => 'commented',
                'changes' => ['comment_id' => 'c'.$i],
                'created_at' => now()->subHours($i + 1),
            ]);
        }
        Activity::create([
            'task_id' => $task->id,
            'user_id' => $teammate->id,
            'action' => 'field_changed',
            'changes' => [
                'description' => ['from' => '<p>secret old</p>', 'to' => '<p>secret new</p>'],
                'due_date' => ['from' => null, 'to' => '2026-10-20'],
            ],
            'created_at' => now()->subMinutes(5),
        ]);

        $activity = $this->props()['recentActivity'];

        $this->assertCount(8, $activity);

        $latest = $activity[0];
        $this->assertSame('field_changed', $latest['action']);
        $this->assertSame(['fields' => ['description', 'due_date']], $latest['changes']);
        $this->assertStringNotContainsString('secret', json_encode($activity));
        $this->assertSame('Bea Teammate', $latest['user']['name']);
        $this->assertSame('Ship the dashboard', $latest['task']['title']);
        $this->assertSame($task->slug, $latest['task']['slug']);
        $this->assertSame($this->board->slug, $latest['board']['slug']);
        $this->assertSame($this->team->slug, $latest['team']['slug']);

        // Newest first.
        $timestamps = array_column($activity, 'created_at');
        $sorted = $timestamps;
        rsort($sorted);
        $this->assertSame($sorted, $timestamps);
    }

    public function test_user_without_teams_gets_an_empty_dashboard(): void
    {
        $loner = User::factory()->create();

        $this->actingAs($loner)
            ->get(route('dashboard'))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('Dashboard')
                ->where('stats.open', 0)
                ->where('stats.overdue', 0)
                ->where('stats.completed_last_7_days', 0)
                ->has('boards', 0)
                ->has('myTasks', 0)
                ->has('recentActivity', 0)
                ->has('teams', 0));
    }
}
