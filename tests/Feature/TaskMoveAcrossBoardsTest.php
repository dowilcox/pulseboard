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

class TaskMoveAcrossBoardsTest extends TestCase
{
    use RefreshDatabase;

    private User $owner;

    private Team $team;

    private Board $board;

    private Column $column;

    private Board $targetBoard;

    private Column $targetColumn;

    protected function setUp(): void
    {
        parent::setUp();

        $this->owner = User::factory()->create();
        $this->team = Team::factory()->create();
        $this->addMember($this->owner, 'owner');

        $this->board = Board::factory()->create(['team_id' => $this->team->id]);
        $this->column = Column::factory()->create(['board_id' => $this->board->id]);

        $this->targetBoard = Board::factory()->create([
            'team_id' => $this->team->id,
            'name' => 'Target Board',
        ]);
        $this->targetColumn = Column::factory()->create([
            'board_id' => $this->targetBoard->id,
            'name' => 'Review',
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

    private function createTask(array $attrs = []): Task
    {
        return Task::factory()->create(array_merge([
            'board_id' => $this->board->id,
            'column_id' => $this->column->id,
            'created_by' => $this->owner->id,
        ], $attrs));
    }

    public function test_cross_board_move_lands_on_new_task_url_with_success_message(): void
    {
        $task = $this->createTask(['title' => 'Ship it', 'task_number' => 4]);

        $response = $this->actingAs($this->owner)->patch(
            route('tasks.move', [$this->team, $this->board, $task]),
            [
                'board_id' => $this->targetBoard->id,
                'column_id' => $this->targetColumn->id,
                'sort_order' => null,
            ]
        );

        $task->refresh();
        $this->assertSame($this->targetBoard->id, $task->board_id);
        $this->assertSame($this->targetColumn->id, $task->column_id);

        // Slug-based URL on the target board (the task number changes).
        $response->assertRedirect(
            route('tasks.show', [$this->team, $this->targetBoard, $task])
        );
        $this->assertStringContainsString(
            '/'.$this->targetBoard->slug.'/tasks/'.$task->slug,
            $response->headers->get('Location'),
        );
        $response->assertSessionHas('success', 'Moved to Target Board › Review.');
    }

    public function test_cross_board_move_rejects_column_that_is_not_on_target_board(): void
    {
        $task = $this->createTask();
        $thirdBoard = Board::factory()->create(['team_id' => $this->team->id]);
        $thirdColumn = Column::factory()->create(['board_id' => $thirdBoard->id]);

        foreach ([$this->column, $thirdColumn] as $wrongColumn) {
            $response = $this->actingAs($this->owner)->patch(
                route('tasks.move', [$this->team, $this->board, $task]),
                [
                    'board_id' => $this->targetBoard->id,
                    'column_id' => $wrongColumn->id,
                    'sort_order' => null,
                ]
            );

            $response->assertNotFound();
        }

        $task->refresh();
        $this->assertSame($this->board->id, $task->board_id);
        $this->assertSame($this->column->id, $task->column_id);
    }

    public function test_same_board_move_rejects_column_from_another_board(): void
    {
        $task = $this->createTask();

        $response = $this->actingAs($this->owner)->patch(
            route('tasks.move', [$this->team, $this->board, $task]),
            ['column_id' => $this->targetColumn->id, 'sort_order' => null]
        );

        $response->assertNotFound();
        $this->assertSame($this->column->id, $task->fresh()->column_id);
    }

    public function test_member_cannot_move_task_to_another_board(): void
    {
        $member = User::factory()->create();
        $this->addMember($member);
        $task = $this->createTask(['created_by' => $member->id]);

        $response = $this->actingAs($member)->patch(
            route('tasks.move', [$this->team, $this->board, $task]),
            [
                'board_id' => $this->targetBoard->id,
                'column_id' => $this->targetColumn->id,
                'sort_order' => null,
            ]
        );

        $response->assertForbidden();
        $this->assertSame($this->board->id, $task->fresh()->board_id);
    }

    public function test_cannot_move_task_to_another_teams_board(): void
    {
        $foreignBoard = Board::factory()->create();
        $foreignColumn = Column::factory()->create(['board_id' => $foreignBoard->id]);
        $task = $this->createTask();

        $response = $this->actingAs($this->owner)->patch(
            route('tasks.move', [$this->team, $this->board, $task]),
            [
                'board_id' => $foreignBoard->id,
                'column_id' => $foreignColumn->id,
                'sort_order' => null,
            ]
        );

        $response->assertNotFound();
        $this->assertSame($this->board->id, $task->fresh()->board_id);
    }

    public function test_cannot_move_task_to_archived_board(): void
    {
        $this->targetBoard->update(['is_archived' => true]);
        $task = $this->createTask();

        $response = $this->actingAs($this->owner)->patch(
            route('tasks.move', [$this->team, $this->board, $task]),
            [
                'board_id' => $this->targetBoard->id,
                'column_id' => $this->targetColumn->id,
                'sort_order' => null,
            ]
        );

        $response->assertNotFound();
        $this->assertSame($this->board->id, $task->fresh()->board_id);
    }
}
