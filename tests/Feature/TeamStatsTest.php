<?php

namespace Tests\Feature;

use App\Models\Board;
use App\Models\Column;
use App\Models\Task;
use App\Models\Team;
use App\Models\TeamMember;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Testing\TestResponse;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

/**
 * Team stats and CSV export are shared by the web team page and the v1 API,
 * so every case here runs against both.
 */
class TeamStatsTest extends TestCase
{
    use RefreshDatabase;

    private User $user;

    private Team $team;

    private Board $board;

    private Board $archivedBoard;

    private Column $column;

    private Column $doneColumn;

    protected function setUp(): void
    {
        parent::setUp();

        // Wednesday, so "this week" starts on Monday 2026-10-26.
        Carbon::setTestNow('2026-10-28 12:00:00');

        $this->user = User::factory()->create();
        $this->team = Team::factory()->create();
        TeamMember::create(['team_id' => $this->team->id, 'user_id' => $this->user->id, 'role' => 'owner']);

        $this->board = Board::factory()->create(['team_id' => $this->team->id]);
        $this->column = Column::factory()->create(['board_id' => $this->board->id, 'name' => 'To Do']);
        $this->doneColumn = Column::factory()->create([
            'board_id' => $this->board->id,
            'name' => 'Done',
            'is_done_column' => true,
        ]);

        $this->archivedBoard = Board::factory()->create(['team_id' => $this->team->id, 'is_archived' => true]);
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();

        parent::tearDown();
    }

    public static function endpoints(): array
    {
        return [
            'web' => ['web'],
            'api' => ['api'],
        ];
    }

    private function getStats(string $via): TestResponse
    {
        if ($via === 'api') {
            $token = $this->user->createToken('test', ['read'])->plainTextToken;

            return $this->withHeader('Authorization', "Bearer {$token}")
                ->getJson("/api/v1/teams/{$this->team->id}/dashboard/stats");
        }

        return $this->actingAs($this->user)->getJson(route('teams.dashboard.stats', $this->team));
    }

    private function getCsv(string $via): string
    {
        if ($via === 'api') {
            $token = $this->user->createToken('test', ['read'])->plainTextToken;
            $response = $this->withHeader('Authorization', "Bearer {$token}")
                ->get("/api/v1/teams/{$this->team->id}/export/csv");
        } else {
            $response = $this->actingAs($this->user)->get(route('teams.export.csv', $this->team));
        }

        $response->assertOk();

        return $response->streamedContent();
    }

    private function task(array $attributes = []): Task
    {
        return Task::factory()->create(array_merge([
            'board_id' => $this->board->id,
            'column_id' => $this->column->id,
            'created_by' => $this->user->id,
            'due_date' => null,
        ], $attributes));
    }

    #[DataProvider('endpoints')]
    public function test_velocity_and_cycle_time_come_from_completed_at(string $via): void
    {
        // Completed this week after 2 and 4 days.
        $this->task(['created_at' => now()->subDays(3), 'completed_at' => now()->subDay()]);
        $this->task(['created_at' => now()->subDays(5), 'completed_at' => now()->subDay()]);
        // Completed two weeks ago after 6 days.
        $this->task(['created_at' => now()->subDays(20), 'completed_at' => now()->subDays(14)]);
        // Completed long ago: outside both windows.
        $this->task(['created_at' => now()->subDays(100), 'completed_at' => now()->subDays(90)]);
        // Open tasks don't count.
        $this->task(['created_at' => now()->subDays(3)]);

        $response = $this->getStats($via)->assertOk();

        $response->assertJsonPath('velocity', [
            ['week' => '2026-10-12', 'completed' => 1],
            ['week' => '2026-10-26', 'completed' => 2],
        ]);
        // (2 + 4 + 6) / 3
        $this->assertEquals(4.0, $response->json('cycle_time'));
    }

    #[DataProvider('endpoints')]
    public function test_cycle_time_is_zero_and_velocity_empty_without_completions(string $via): void
    {
        $this->task();

        $this->getStats($via)
            ->assertOk()
            ->assertJsonPath('velocity', [])
            ->assertJsonPath('cycle_time', 0);
    }

    #[DataProvider('endpoints')]
    public function test_stats_exclude_archived_boards(string $via): void
    {
        $archivedColumn = Column::factory()->create(['board_id' => $this->archivedBoard->id]);
        $archived = Task::factory()->create([
            'board_id' => $this->archivedBoard->id,
            'column_id' => $archivedColumn->id,
            'created_by' => $this->user->id,
            'priority' => 'urgent',
            'due_date' => now()->subDays(3),
        ]);
        $archived->assignees()->attach($this->user->id, ['assigned_at' => now(), 'assigned_by' => $this->user->id]);
        Task::factory()->create([
            'board_id' => $this->archivedBoard->id,
            'column_id' => $archivedColumn->id,
            'created_by' => $this->user->id,
            'completed_at' => now()->subDay(),
            'created_at' => now()->subDays(2),
        ]);

        $this->task(['priority' => 'low']);

        $this->getStats($via)
            ->assertOk()
            ->assertJsonPath('tasks_by_priority', ['low' => 1])
            ->assertJsonCount(0, 'overdue_tasks')
            ->assertJsonCount(0, 'workload')
            ->assertJsonPath('velocity', [])
            ->assertJsonPath('cycle_time', 0);
    }

    #[DataProvider('endpoints')]
    public function test_tasks_by_column_rows_carry_only_the_aggregate_fields(string $via): void
    {
        $this->task();

        $rows = $this->getStats($via)
            ->assertOk()
            ->assertJsonCount(1, 'tasks_by_column')
            ->json('tasks_by_column');

        $this->assertEqualsCanonicalizing(['column_name', 'is_done_column', 'count'], array_keys($rows[0]));
        $this->assertSame('To Do', $rows[0]['column_name']);
        $this->assertSame(1, (int) $rows[0]['count']);
    }

    #[DataProvider('endpoints')]
    public function test_workload_counts_open_tasks_only(string $via): void
    {
        $open = $this->task();
        $completedOutsideDoneColumn = $this->task(['completed_at' => now()]);
        foreach ([$open, $completedOutsideDoneColumn] as $task) {
            $task->assignees()->attach($this->user->id, ['assigned_at' => now(), 'assigned_by' => $this->user->id]);
        }

        $this->getStats($via)
            ->assertOk()
            ->assertJsonPath('workload.0.task_count', 1);
    }

    #[DataProvider('endpoints')]
    public function test_csv_excludes_archived_boards_and_uses_completed_at_for_status(string $via): void
    {
        $archivedColumn = Column::factory()->create(['board_id' => $this->archivedBoard->id]);
        Task::factory()->create([
            'board_id' => $this->archivedBoard->id,
            'column_id' => $archivedColumn->id,
            'created_by' => $this->user->id,
            'title' => 'Archived board task',
        ]);

        $this->task(['title' => 'Completed outside done column', 'completed_at' => now()]);
        $this->task(['title' => 'Reopened in done column', 'column_id' => $this->doneColumn->id]);

        $rows = collect(explode("\n", trim($this->getCsv($via))))
            ->map(fn (string $line) => str_getcsv($line))
            ->keyBy(fn (array $row) => $row[3]);

        $this->assertFalse($rows->has('Archived board task'));
        $this->assertSame('Done', $rows['Completed outside done column'][5]);
        $this->assertSame('In Progress', $rows['Reopened in done column'][5]);
    }
}
