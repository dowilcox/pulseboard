<?php

namespace Tests\Feature\Api\V1;

use App\Models\Board;
use App\Models\Column;
use App\Models\Task;
use App\Models\Team;
use App\Models\TeamMember;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DashboardApiTest extends TestCase
{
    use RefreshDatabase;

    private User $user;

    private Team $team;

    private Board $board;

    private Column $column;

    private Column $doneColumn;

    private string $token;

    protected function setUp(): void
    {
        parent::setUp();

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
        $this->token = $this->user->createToken('test', ['read'])->plainTextToken;
    }

    private function api(): static
    {
        return $this->withHeader('Authorization', "Bearer {$this->token}");
    }

    public function test_team_stats(): void
    {
        $overdue = Task::factory()->create([
            'board_id' => $this->board->id,
            'column_id' => $this->column->id,
            'created_by' => $this->user->id,
            'priority' => 'high',
            'due_date' => now()->subDays(3),
            'completed_at' => null,
        ]);
        Task::factory()->create([
            'board_id' => $this->board->id,
            'column_id' => $this->column->id,
            'created_by' => $this->user->id,
            'priority' => 'low',
            'effort_estimate' => 4,
        ]);
        $done = Task::factory()->create([
            'board_id' => $this->board->id,
            'column_id' => $this->doneColumn->id,
            'created_by' => $this->user->id,
            'priority' => 'high',
        ]);

        // Assign a task for workload stats
        $overdue->assignees()->attach($this->user->id, ['assigned_at' => now(), 'assigned_by' => $this->user->id]);

        // A "moved to done" activity for velocity/cycle time
        $done->activities()->create([
            'user_id' => $this->user->id,
            'action' => 'moved',
            'changes' => ['to_done' => true],
            'created_at' => now()->subDay(),
        ]);

        $response = $this->api()->getJson("/api/v1/teams/{$this->team->id}/dashboard/stats");

        $response->assertOk();
        $response->assertJsonStructure([
            'tasks_by_column',
            'tasks_by_priority',
            'overdue_tasks',
            'workload',
            'velocity',
            'cycle_time',
        ]);

        $response->assertJsonPath('tasks_by_priority.high', 2);
        $response->assertJsonPath('tasks_by_priority.low', 1);
        $response->assertJsonCount(1, 'overdue_tasks');
        $response->assertJsonPath('overdue_tasks.0.id', $overdue->id);
        $response->assertJsonPath('workload.0.name', $this->user->name);
        $response->assertJsonPath('workload.0.task_count', 1);
        $response->assertJsonCount(1, 'velocity');
        $response->assertJsonPath('velocity.0.completed', 1);

        $columns = collect($response->json('tasks_by_column'));
        $this->assertEquals(2, $columns->firstWhere('column_name', 'To Do')['count']);
        $this->assertEquals(1, $columns->firstWhere('column_name', 'Done')['count']);
    }

    public function test_team_stats_forbidden_for_non_member(): void
    {
        $stranger = User::factory()->create();
        $token = $stranger->createToken('test', ['read'])->plainTextToken;

        $this->withHeader('Authorization', "Bearer {$token}")
            ->getJson("/api/v1/teams/{$this->team->id}/dashboard/stats")
            ->assertForbidden();
    }

    public function test_export_csv(): void
    {
        Task::factory()->create([
            'board_id' => $this->board->id,
            'column_id' => $this->column->id,
            'created_by' => $this->user->id,
            'title' => 'Exported Task',
            'priority' => 'high',
        ]);

        $response = $this->api()->get("/api/v1/teams/{$this->team->id}/export/csv");

        $response->assertOk();
        $this->assertStringContainsString('text/csv', $response->headers->get('Content-Type'));
        $this->assertStringContainsString('attachment', $response->headers->get('Content-Disposition'));

        $csv = $response->streamedContent();
        $this->assertStringContainsString('Board,Column,"Task Number",Title,Priority', $csv);
        $this->assertStringContainsString('Exported Task', $csv);
        $this->assertStringContainsString($this->board->name, $csv);
    }

    public function test_export_csv_forbidden_for_non_member(): void
    {
        $stranger = User::factory()->create();
        $token = $stranger->createToken('test', ['read'])->plainTextToken;

        $this->withHeader('Authorization', "Bearer {$token}")
            ->get("/api/v1/teams/{$this->team->id}/export/csv")
            ->assertForbidden();
    }
}
