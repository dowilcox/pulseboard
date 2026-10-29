<?php

namespace Tests\Feature;

use App\Models\Board;
use App\Models\Column;
use App\Models\Task;
use App\Models\TaskDependency;
use App\Models\Team;
use App\Models\TeamMember;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * A task is blocked only while at least one of its blockers is open.
 */
class TaskBlockedStateTest extends TestCase
{
    use RefreshDatabase;

    private User $user;

    private Team $team;

    private Board $board;

    private Column $column;

    /** @var array<string, Task> */
    private array $tasks = [];

    protected function setUp(): void
    {
        parent::setUp();

        $this->user = User::factory()->create();
        $this->team = Team::factory()->create();
        TeamMember::create(['team_id' => $this->team->id, 'user_id' => $this->user->id, 'role' => 'owner']);
        $this->board = Board::factory()->create(['team_id' => $this->team->id]);
        $this->column = Column::factory()->create(['board_id' => $this->board->id]);

        $open = $this->task('open blocker');
        $done = $this->task('done blocker', ['completed_at' => now()]);

        $this->tasks['by open'] = $this->task('by open');
        $this->tasks['by done'] = $this->task('by done');
        $this->tasks['by both'] = $this->task('by both');
        $this->tasks['free'] = $this->task('free');

        $this->depend($this->tasks['by open'], $open);
        $this->depend($this->tasks['by done'], $done);
        $this->depend($this->tasks['by both'], $open);
        $this->depend($this->tasks['by both'], $done);
    }

    private function task(string $title, array $attributes = []): Task
    {
        return Task::factory()->create(array_merge([
            'board_id' => $this->board->id,
            'column_id' => $this->column->id,
            'created_by' => $this->user->id,
            'title' => $title,
        ], $attributes));
    }

    private function depend(Task $task, Task $blocker): void
    {
        TaskDependency::create([
            'task_id' => $task->id,
            'depends_on_task_id' => $blocker->id,
            'created_by' => $this->user->id,
        ]);
    }

    /**
     * @param  iterable<array<string, mixed>>  $tasks
     */
    private function assertBlockedStates(iterable $tasks): void
    {
        $states = collect($tasks)->pluck('is_blocked', 'title');

        $this->assertSame(true, $states['by open']);
        $this->assertSame(false, $states['by done']);
        $this->assertSame(true, $states['by both']);
        $this->assertSame(false, $states['free']);
        $this->assertSame(false, $states['open blocker']);
    }

    public function test_scope_only_counts_open_blockers(): void
    {
        $this->assertBlockedStates(Task::withBlockedState()->get()->toArray());
    }

    public function test_board_page_cards_only_count_open_blockers(): void
    {
        $this->actingAs($this->user)
            ->get(route('teams.boards.show', [$this->team, $this->board]))
            ->assertInertia(function ($page) {
                $this->assertBlockedStates($page->toArray()['props']['columns'][0]['tasks']);
            });
    }

    public function test_board_task_endpoint_only_counts_open_blockers(): void
    {
        $response = $this->actingAs($this->user)
            ->getJson(route('boards.tasks.index', [$this->team, $this->board]))
            ->assertOk();

        $this->assertBlockedStates($response->json('data'));
    }

    public function test_api_task_list_only_counts_open_blockers(): void
    {
        $token = $this->user->createToken('test', ['read'])->plainTextToken;

        $response = $this->withHeader('Authorization', "Bearer {$token}")
            ->getJson("/api/v1/teams/{$this->team->id}/boards/{$this->board->id}/tasks")
            ->assertOk();

        $this->assertBlockedStates($response->json('data'));
        // blocked_by still lists every dependency.
        $this->assertCount(1, collect($response->json('data'))->firstWhere('title', 'by done')['blocked_by']);
    }
}
