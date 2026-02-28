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

class TaskChecklistTest extends TestCase
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

    public function test_can_add_checklists_to_task(): void
    {
        $task = Task::factory()->create([
            'board_id' => $this->board->id,
            'column_id' => $this->column->id,
            'created_by' => $this->user->id,
        ]);

        $checklists = [
            [
                'id' => 'cl-1',
                'title' => 'Setup',
                'items' => [
                    ['id' => 'item-1', 'text' => 'Install dependencies', 'completed' => false],
                    ['id' => 'item-2', 'text' => 'Create database', 'completed' => true],
                ],
            ],
        ];

        $response = $this->actingAs($this->user)->put(
            route('tasks.update', [$this->team, $this->board, $task]),
            ['checklists' => $checklists]
        );

        $response->assertRedirect();
        $task->refresh();
        $this->assertCount(1, $task->checklists);
        $this->assertEquals('Setup', $task->checklists[0]['title']);
        $this->assertCount(2, $task->checklists[0]['items']);
    }

    public function test_checklist_progress_accessor(): void
    {
        $task = Task::factory()->create([
            'board_id' => $this->board->id,
            'column_id' => $this->column->id,
            'created_by' => $this->user->id,
            'checklists' => [
                [
                    'id' => 'cl-1',
                    'title' => 'Checklist',
                    'items' => [
                        ['id' => 'i1', 'text' => 'Done', 'completed' => true],
                        ['id' => 'i2', 'text' => 'Not done', 'completed' => false],
                        ['id' => 'i3', 'text' => 'Also done', 'completed' => true],
                    ],
                ],
            ],
        ]);

        $this->assertEquals(['completed' => 2, 'total' => 3], $task->checklist_progress);
    }

    public function test_checklist_progress_null_when_no_checklists(): void
    {
        $task = Task::factory()->create([
            'board_id' => $this->board->id,
            'column_id' => $this->column->id,
            'created_by' => $this->user->id,
        ]);

        $this->assertNull($task->checklist_progress);
    }

    public function test_checklist_validation_rejects_invalid_data(): void
    {
        $task = Task::factory()->create([
            'board_id' => $this->board->id,
            'column_id' => $this->column->id,
            'created_by' => $this->user->id,
        ]);

        $response = $this->actingAs($this->user)->put(
            route('tasks.update', [$this->team, $this->board, $task]),
            ['checklists' => [['missing_required_fields' => true]]]
        );

        $response->assertSessionHasErrors();
    }

    public function test_multiple_checklists(): void
    {
        $task = Task::factory()->create([
            'board_id' => $this->board->id,
            'column_id' => $this->column->id,
            'created_by' => $this->user->id,
        ]);

        $checklists = [
            [
                'id' => 'cl-1',
                'title' => 'Frontend',
                'items' => [
                    ['id' => 'i1', 'text' => 'Build UI', 'completed' => true],
                ],
            ],
            [
                'id' => 'cl-2',
                'title' => 'Backend',
                'items' => [
                    ['id' => 'i2', 'text' => 'Create API', 'completed' => false],
                    ['id' => 'i3', 'text' => 'Write tests', 'completed' => false],
                ],
            ],
        ];

        $this->actingAs($this->user)->put(
            route('tasks.update', [$this->team, $this->board, $task]),
            ['checklists' => $checklists]
        );

        $task->refresh();
        $this->assertCount(2, $task->checklists);
        $this->assertEquals(['completed' => 1, 'total' => 3], $task->checklist_progress);
    }
}
