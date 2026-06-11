<?php

namespace Tests\Feature;

use App\Models\Board;
use App\Models\Column;
use App\Models\Label;
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

    public function test_cannot_delete_another_teams_template(): void
    {
        $otherTeam = Team::factory()->create();
        $foreignTemplate = TaskTemplate::factory()->create([
            'team_id' => $otherTeam->id,
        ]);

        $response = $this->actingAs($this->user)->delete(
            route('teams.task-templates.destroy', [$this->team, $foreignTemplate])
        );

        $response->assertNotFound();
        $this->assertDatabaseHas('task_templates', ['id' => $foreignTemplate->id]);
    }

    public function test_cannot_create_task_from_another_teams_template(): void
    {
        $otherTeam = Team::factory()->create();
        $foreignTemplate = TaskTemplate::factory()->create([
            'team_id' => $otherTeam->id,
        ]);

        $response = $this->actingAs($this->user)->post(
            route('tasks.from-template', [$this->team, $this->board, $this->column, $foreignTemplate])
        );

        $response->assertNotFound();
        $this->assertDatabaseCount('tasks', 0);
    }

    public function test_member_cannot_create_or_delete_template(): void
    {
        $member = User::factory()->create();
        TeamMember::create([
            'team_id' => $this->team->id,
            'user_id' => $member->id,
            'role' => 'member',
        ]);
        $template = TaskTemplate::factory()->create([
            'team_id' => $this->team->id,
            'created_by' => $this->user->id,
        ]);

        $this->actingAs($member)
            ->post(route('teams.task-templates.store', [$this->team]), [
                'name' => 'Nope',
            ])
            ->assertForbidden();

        $this->actingAs($member)
            ->delete(route('teams.task-templates.destroy', [$this->team, $template]))
            ->assertForbidden();

        $this->assertDatabaseHas('task_templates', ['id' => $template->id]);
    }

    public function test_create_task_from_template_with_deleted_label_succeeds(): void
    {
        $label = Label::factory()->create(['team_id' => $this->team->id]);
        $template = TaskTemplate::factory()->create([
            'team_id' => $this->team->id,
            'created_by' => $this->user->id,
            'name' => 'Stale Label Template',
            'label_ids' => [$label->id],
        ]);
        $label->delete();

        $response = $this->actingAs($this->user)->post(
            route('tasks.from-template', [$this->team, $this->board, $this->column, $template])
        );

        $response->assertRedirect();
        $task = Task::where('title', 'Stale Label Template')->first();
        $this->assertNotNull($task);
        $this->assertCount(0, $task->labels);
    }

    public function test_web_task_creation_applies_board_default_template(): void
    {
        $label = Label::factory()->create(['team_id' => $this->team->id]);
        $template = TaskTemplate::factory()->create([
            'team_id' => $this->team->id,
            'created_by' => $this->user->id,
            'description_template' => '<p>Default description</p>',
            'priority' => 'high',
            'effort_estimate' => 5,
            'label_ids' => [$label->id],
        ]);
        $this->board->update(['default_task_template_id' => $template->id]);

        $response = $this->actingAs($this->user)->post(
            route('tasks.store', [$this->team, $this->board, $this->column]),
            ['title' => 'Web Default Task']
        );

        $response->assertRedirect();
        $task = Task::where('title', 'Web Default Task')->first();
        $this->assertNotNull($task);
        $this->assertSame('high', $task->priority);
        $this->assertSame(5, $task->effort_estimate);
        $this->assertTrue($task->labels->contains($label));
    }

    public function test_api_task_creation_applies_board_default_template(): void
    {
        $label = Label::factory()->create(['team_id' => $this->team->id]);
        $template = TaskTemplate::factory()->create([
            'team_id' => $this->team->id,
            'created_by' => $this->user->id,
            'description_template' => '<p>Default description</p>',
            'priority' => 'high',
            'effort_estimate' => 5,
            'label_ids' => [$label->id],
        ]);
        $this->board->update(['default_task_template_id' => $template->id]);

        $token = $this->user->createToken('test', ['read', 'write'])->plainTextToken;

        $response = $this->withHeader('Authorization', "Bearer $token")->postJson(
            "/api/v1/teams/{$this->team->id}/boards/{$this->board->id}/columns/{$this->column->id}/tasks",
            ['title' => 'API Default Task']
        );

        $response->assertCreated();
        $task = Task::where('title', 'API Default Task')->first();
        $this->assertNotNull($task);
        $this->assertSame('high', $task->priority);
        $this->assertSame(5, $task->effort_estimate);
        $this->assertTrue($task->labels->contains($label));
    }

    public function test_task_creation_survives_default_template_with_deleted_label(): void
    {
        $label = Label::factory()->create(['team_id' => $this->team->id]);
        $template = TaskTemplate::factory()->create([
            'team_id' => $this->team->id,
            'created_by' => $this->user->id,
            'priority' => 'medium',
            'label_ids' => [$label->id],
        ]);
        $this->board->update(['default_task_template_id' => $template->id]);
        $label->delete();

        $response = $this->actingAs($this->user)->post(
            route('tasks.store', [$this->team, $this->board, $this->column]),
            ['title' => 'Survives Stale Label']
        );

        $response->assertRedirect();
        $response->assertSessionHasNoErrors();
        $task = Task::where('title', 'Survives Stale Label')->first();
        $this->assertNotNull($task);
        $this->assertSame('medium', $task->priority);
        $this->assertCount(0, $task->labels);
    }

    public function test_explicit_values_override_board_default_template(): void
    {
        $template = TaskTemplate::factory()->create([
            'team_id' => $this->team->id,
            'created_by' => $this->user->id,
            'priority' => 'high',
            'effort_estimate' => 5,
        ]);
        $this->board->update(['default_task_template_id' => $template->id]);

        $response = $this->actingAs($this->user)->post(
            route('tasks.store', [$this->team, $this->board, $this->column]),
            ['title' => 'Explicit Task', 'priority' => 'low']
        );

        $response->assertRedirect();
        $task = Task::where('title', 'Explicit Task')->first();
        $this->assertNotNull($task);
        $this->assertSame('low', $task->priority);
        $this->assertSame(5, $task->effort_estimate);
    }
}
