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
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

class TaskShowPageTest extends TestCase
{
    use RefreshDatabase;

    private User $owner;

    private Team $team;

    private Board $board;

    private Column $column;

    private Board $otherBoard;

    private Column $otherColumn;

    protected function setUp(): void
    {
        parent::setUp();

        $this->owner = User::factory()->create();
        $this->team = Team::factory()->create();
        $this->addMember($this->owner, 'owner');

        $this->board = Board::factory()->create([
            'team_id' => $this->team->id,
            'name' => 'Current Board',
            'sort_order' => 1,
        ]);
        $this->column = Column::factory()->create(['board_id' => $this->board->id]);

        $this->otherBoard = Board::factory()->create([
            'team_id' => $this->team->id,
            'name' => 'Other Board',
            'sort_order' => 2,
        ]);
        $this->otherColumn = Column::factory()->create([
            'board_id' => $this->otherBoard->id,
            'name' => 'Backlog',
            'wip_limit' => 3,
        ]);
    }

    private function addMember(User $user, string $role = 'member'): void
    {
        TeamMember::create([
            'team_id' => $this->team->id,
            'user_id' => $user->id,
            'role' => $role,
        ]);
    }

    private function createTask(Board $board, Column $column, array $attrs = []): Task
    {
        return Task::factory()->create(array_merge([
            'board_id' => $board->id,
            'column_id' => $column->id,
            'created_by' => $this->owner->id,
        ], $attrs));
    }

    /**
     * Simulate the partial reload Inertia performs for deferred props.
     */
    private function getDeferred(User $user, Task $task, string $props): TestResponse
    {
        $initial = $this->actingAs($user)->get(
            route('tasks.show', [$this->team, $this->board, $task])
        );
        $initial->assertOk();
        $version = (string) ($initial->viewData('page')['version'] ?? '');

        return $this->actingAs($user)->get(
            route('tasks.show', [$this->team, $this->board, $task]),
            [
                'X-Inertia' => 'true',
                'X-Inertia-Version' => $version,
                'X-Inertia-Partial-Component' => 'Tasks/Show',
                'X-Inertia-Partial-Data' => $props,
            ]
        );
    }

    public function test_owner_gets_full_permissions_and_move_targets_with_columns(): void
    {
        Board::factory()->create([
            'team_id' => $this->team->id,
            'name' => 'Archived Board',
            'is_archived' => true,
        ]);
        $task = $this->createTask($this->board, $this->column);
        $this->createTask($this->otherBoard, $this->otherColumn);

        $response = $this->actingAs($this->owner)->get(
            route('tasks.show', [$this->team, $this->board, $task])
        );

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->component('Tasks/Show')
            ->where('can.update', true)
            ->where('can.delete', true)
            ->where('can.move', true)
            ->where('can.saveAsTemplate', true)
            // Only other, active boards are move targets.
            ->has('moveTargets', 1)
            ->where('moveTargets.0.id', $this->otherBoard->id)
            ->where('moveTargets.0.name', 'Other Board')
            ->where('moveTargets.0.slug', $this->otherBoard->slug)
            ->has('moveTargets.0.columns', 1)
            ->where('moveTargets.0.columns.0.id', $this->otherColumn->id)
            ->where('moveTargets.0.columns.0.name', 'Backlog')
            ->where('moveTargets.0.columns.0.wip_limit', 3)
            ->where('moveTargets.0.columns.0.tasks_count', 1)
        );
    }

    public function test_member_cannot_delete_others_task_or_move_it_across_boards(): void
    {
        $member = User::factory()->create();
        $this->addMember($member);
        $task = $this->createTask($this->board, $this->column);

        $response = $this->actingAs($member)->get(
            route('tasks.show', [$this->team, $this->board, $task])
        );

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->where('can.update', true)
            ->where('can.delete', false)
            ->where('can.move', false)
            ->where('can.saveAsTemplate', false)
            ->has('moveTargets', 0)
        );
    }

    public function test_member_can_delete_own_task(): void
    {
        $member = User::factory()->create();
        $this->addMember($member);
        $task = $this->createTask($this->board, $this->column, [
            'created_by' => $member->id,
        ]);

        $response = $this->actingAs($member)->get(
            route('tasks.show', [$this->team, $this->board, $task])
        );

        $response->assertInertia(fn ($page) => $page
            ->where('can.delete', true)
            ->where('can.move', false)
        );
    }

    public function test_admin_without_other_boards_has_no_move_targets(): void
    {
        $this->otherBoard->update(['is_archived' => true]);
        $task = $this->createTask($this->board, $this->column);

        $response = $this->actingAs($this->owner)->get(
            route('tasks.show', [$this->team, $this->board, $task])
        );

        $response->assertInertia(fn ($page) => $page
            ->where('can.move', false)
            ->has('moveTargets', 0)
        );
    }

    public function test_dependency_candidates_span_team_boards_with_board_names(): void
    {
        $task = $this->createTask($this->board, $this->column, ['title' => 'Current']);
        $sameBoardDone = $this->createTask($this->board, $this->column, [
            'title' => 'Same board done',
            'completed_at' => now(),
        ]);
        $otherOpen = $this->createTask($this->otherBoard, $this->otherColumn, [
            'title' => 'Other board open',
        ]);
        $otherDone = $this->createTask($this->otherBoard, $this->otherColumn, [
            'title' => 'Other board done',
            'completed_at' => now(),
        ]);

        $otherTeamBoard = Board::factory()->create();
        $otherTeamColumn = Column::factory()->create(['board_id' => $otherTeamBoard->id]);
        $foreign = $this->createTask($otherTeamBoard, $otherTeamColumn);

        $response = $this->getDeferred($this->owner, $task, 'boardTasks');

        $response->assertOk();
        $candidates = collect($response->json('props.boardTasks'));
        $ids = $candidates->pluck('id');

        // Current-board tasks come first.
        $this->assertSame($this->board->id, $candidates->first()['board_id']);
        $this->assertTrue($ids->contains($task->id));
        $this->assertTrue($ids->contains($sameBoardDone->id));
        $this->assertTrue($ids->contains($otherOpen->id));
        $this->assertFalse($ids->contains($otherDone->id));
        $this->assertFalse($ids->contains($foreign->id));

        $other = $candidates->firstWhere('id', $otherOpen->id);
        $this->assertSame('Other Board', $other['board']['name']);
        $this->assertSame($this->otherBoard->slug, $other['board']['slug']);
        $this->assertSame($otherOpen->slug, $other['slug']);
    }

    public function test_dependencies_include_their_board_for_cross_board_links(): void
    {
        $task = $this->createTask($this->board, $this->column);
        $blocker = $this->createTask($this->otherBoard, $this->otherColumn);
        $dependent = $this->createTask($this->board, $this->column);

        TaskDependency::create([
            'task_id' => $task->id,
            'depends_on_task_id' => $blocker->id,
            'created_by' => $this->owner->id,
        ]);
        TaskDependency::create([
            'task_id' => $dependent->id,
            'depends_on_task_id' => $task->id,
            'created_by' => $this->owner->id,
        ]);

        $response = $this->actingAs($this->owner)->get(
            route('tasks.show', [$this->team, $this->board, $task])
        );

        $response->assertInertia(fn ($page) => $page
            ->where('task.blocked_by.0.id', $blocker->id)
            ->where('task.blocked_by.0.board.name', 'Other Board')
            ->where('task.blocked_by.0.board.slug', $this->otherBoard->slug)
            ->where('task.dependencies.0.id', $dependent->id)
            ->where('task.dependencies.0.board.slug', $this->board->slug)
        );
    }
}
