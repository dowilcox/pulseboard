<?php

namespace Tests\Feature;

use App\Models\Board;
use App\Models\Column;
use App\Models\Task;
use App\Models\TaskTemplate;
use App\Models\Team;
use App\Models\TeamMember;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class TaskTemplateTest extends TestCase
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

    public function test_can_create_template(): void
    {
        $response = $this->actingAs($this->user)->post(
            route('teams.task-templates.store', [$this->team]),
            [
                'name' => 'Bug Report',
                'description_template' => '<h2>Steps to Reproduce</h2><ol><li></li></ol>',
                'priority' => 'high',
                'effort_estimate' => 5,
            ]
        );

        $response->assertRedirect();
        $this->assertDatabaseHas('task_templates', [
            'team_id' => $this->team->id,
            'name' => 'Bug Report',
            'priority' => 'high',
        ]);
    }

    public function test_can_list_templates(): void
    {
        TaskTemplate::factory()->count(3)->create([
            'team_id' => $this->team->id,
            'created_by' => $this->user->id,
        ]);

        $response = $this->actingAs($this->user)->get(
            route('teams.task-templates.index', [$this->team])
        );

        $response->assertOk();
    }

    public function test_can_delete_template(): void
    {
        $template = TaskTemplate::factory()->create([
            'team_id' => $this->team->id,
            'created_by' => $this->user->id,
        ]);

        $response = $this->actingAs($this->user)->delete(
            route('teams.task-templates.destroy', [$this->team, $template])
        );

        $response->assertRedirect();
        $this->assertDatabaseMissing('task_templates', ['id' => $template->id]);
    }

    public function test_can_save_task_as_template(): void
    {
        $task = Task::factory()->create([
            'board_id' => $this->board->id,
            'column_id' => $this->column->id,
            'created_by' => $this->user->id,
            'title' => 'My Task',
            'description' => '<p>Task description</p>',
            'priority' => 'medium',
            'effort_estimate' => 3,
            'checklists' => [
                ['id' => 'cl-1', 'title' => 'Steps', 'items' => []],
            ],
        ]);

        $response = $this->actingAs($this->user)->post(
            route('tasks.save-template', [$this->team, $this->board, $task]),
            ['name' => 'My Template']
        );

        $response->assertRedirect();
        $this->assertDatabaseHas('task_templates', [
            'team_id' => $this->team->id,
            'name' => 'My Template',
            'priority' => 'medium',
        ]);
    }

    public function test_can_create_task_from_template(): void
    {
        $template = TaskTemplate::factory()->create([
            'team_id' => $this->team->id,
            'created_by' => $this->user->id,
            'name' => 'Feature Template',
            'description_template' => '<p>Feature description</p>',
            'priority' => 'high',
            'effort_estimate' => 8,
        ]);

        $response = $this->actingAs($this->user)->post(
            route('tasks.from-template', [$this->team, $this->board, $this->column, $template])
        );

        $response->assertRedirect();
        $this->assertDatabaseHas('tasks', [
            'column_id' => $this->column->id,
            'title' => 'Feature Template',
            'priority' => 'high',
        ]);
    }
}
