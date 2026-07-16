<?php

namespace Tests\Feature\Api\V1;

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

class TaskTemplateApiTest extends TestCase
{
    use RefreshDatabase;

    private User $user;

    private Team $team;

    private Board $board;

    private Column $column;

    private string $token;

    protected function setUp(): void
    {
        parent::setUp();

        $this->user = User::factory()->create();
        $this->team = Team::factory()->create();
        TeamMember::create(['team_id' => $this->team->id, 'user_id' => $this->user->id, 'role' => 'owner']);
        $this->board = Board::factory()->create(['team_id' => $this->team->id]);
        $this->column = Column::factory()->create(['board_id' => $this->board->id]);
        $this->token = $this->user->createToken('test', ['read', 'write'])->plainTextToken;
    }

    private function api(?string $token = null): static
    {
        return $this->withHeader('Authorization', 'Bearer '.($token ?? $this->token));
    }

    public function test_list_templates(): void
    {
        TaskTemplate::factory()->count(2)->create([
            'team_id' => $this->team->id,
            'created_by' => $this->user->id,
        ]);
        TaskTemplate::factory()->create(); // other team

        $response = $this->api()->getJson("/api/v1/teams/{$this->team->id}/task-templates");

        $response->assertOk();
        $response->assertJsonCount(2, 'data');
        $response->assertJsonStructure(['data' => [['id', 'name', 'creator']]]);
    }

    public function test_create_template(): void
    {
        $label = Label::factory()->create(['team_id' => $this->team->id]);

        $response = $this->api()->postJson("/api/v1/teams/{$this->team->id}/task-templates", [
            'name' => 'Bug Report',
            'description_template' => '<p>Steps to reproduce</p>',
            'priority' => 'high',
            'effort_estimate' => 3,
            'checklists' => [['title' => 'QA', 'items' => [['text' => 'Verify fix', 'done' => false]]]],
            'label_ids' => [$label->id],
        ]);

        $response->assertCreated();
        $response->assertJsonPath('data.name', 'Bug Report');
        $response->assertJsonPath('data.priority', 'high');
        $response->assertJsonPath('data.effort_estimate', 3);
        $response->assertJsonPath('data.label_ids.0', $label->id);
        $this->assertDatabaseHas('task_templates', ['name' => 'Bug Report', 'team_id' => $this->team->id]);
    }

    public function test_create_template_requires_write_ability(): void
    {
        $token = $this->user->createToken('read-only', ['read'])->plainTextToken;

        $this->api($token)
            ->postJson("/api/v1/teams/{$this->team->id}/task-templates", ['name' => 'Nope'])
            ->assertForbidden();
    }

    public function test_member_cannot_create_template(): void
    {
        $member = User::factory()->create();
        TeamMember::create(['team_id' => $this->team->id, 'user_id' => $member->id, 'role' => 'member']);
        $token = $member->createToken('member', ['read', 'write'])->plainTextToken;

        $this->api($token)
            ->postJson("/api/v1/teams/{$this->team->id}/task-templates", ['name' => 'Nope'])
            ->assertForbidden();
    }

    public function test_delete_template(): void
    {
        $template = TaskTemplate::factory()->create([
            'team_id' => $this->team->id,
            'created_by' => $this->user->id,
        ]);

        $response = $this->api()->deleteJson("/api/v1/teams/{$this->team->id}/task-templates/{$template->id}");

        $response->assertNoContent();
        $this->assertDatabaseMissing('task_templates', ['id' => $template->id]);
    }

    public function test_cannot_delete_template_from_another_team(): void
    {
        $foreign = TaskTemplate::factory()->create();

        $this->api()
            ->deleteJson("/api/v1/teams/{$this->team->id}/task-templates/{$foreign->id}")
            ->assertNotFound();

        $this->assertDatabaseHas('task_templates', ['id' => $foreign->id]);
    }

    public function test_create_template_from_task(): void
    {
        $label = Label::factory()->create(['team_id' => $this->team->id]);
        $task = Task::factory()->create([
            'board_id' => $this->board->id,
            'column_id' => $this->column->id,
            'created_by' => $this->user->id,
            'description' => '<p>Task body</p>',
            'priority' => 'urgent',
            'effort_estimate' => 5,
        ]);
        $task->labels()->attach($label->id);

        $response = $this->api()->postJson(
            "/api/v1/teams/{$this->team->id}/boards/{$this->board->id}/tasks/{$task->id}/save-template",
            ['name' => 'From Task']
        );

        $response->assertCreated();
        $response->assertJsonPath('data.name', 'From Task');
        $response->assertJsonPath('data.description_template', '<p>Task body</p>');
        $response->assertJsonPath('data.priority', 'urgent');
        $response->assertJsonPath('data.effort_estimate', 5);
        $response->assertJsonPath('data.label_ids.0', $label->id);
    }

    public function test_create_template_from_task_requires_name(): void
    {
        $task = Task::factory()->create([
            'board_id' => $this->board->id,
            'column_id' => $this->column->id,
            'created_by' => $this->user->id,
        ]);

        $this->api()
            ->postJson("/api/v1/teams/{$this->team->id}/boards/{$this->board->id}/tasks/{$task->id}/save-template", [])
            ->assertUnprocessable();
    }

    public function test_create_task_from_template(): void
    {
        $template = TaskTemplate::factory()->create([
            'team_id' => $this->team->id,
            'created_by' => $this->user->id,
            'name' => 'Release Checklist',
            'description_template' => '<p>Ship it</p>',
            'priority' => 'medium',
            'effort_estimate' => 2,
            'checklists' => [['title' => 'Steps', 'items' => []]],
        ]);

        $response = $this->api()->postJson(
            "/api/v1/teams/{$this->team->id}/boards/{$this->board->id}/columns/{$this->column->id}/tasks/from-template/{$template->id}"
        );

        $response->assertCreated();
        $response->assertJsonPath('data.title', 'Release Checklist');
        $response->assertJsonPath('data.description', '<p>Ship it</p>');
        $response->assertJsonPath('data.priority', 'medium');
        $this->assertDatabaseHas('tasks', [
            'title' => 'Release Checklist',
            'board_id' => $this->board->id,
            'column_id' => $this->column->id,
        ]);
    }

    public function test_create_task_from_template_with_custom_title(): void
    {
        $template = TaskTemplate::factory()->create([
            'team_id' => $this->team->id,
            'created_by' => $this->user->id,
        ]);

        $response = $this->api()->postJson(
            "/api/v1/teams/{$this->team->id}/boards/{$this->board->id}/columns/{$this->column->id}/tasks/from-template/{$template->id}",
            ['title' => 'Custom Title']
        );

        $response->assertCreated();
        $response->assertJsonPath('data.title', 'Custom Title');
    }

    public function test_create_task_from_foreign_template_returns_404(): void
    {
        $foreign = TaskTemplate::factory()->create();

        $this->api()
            ->postJson(
                "/api/v1/teams/{$this->team->id}/boards/{$this->board->id}/columns/{$this->column->id}/tasks/from-template/{$foreign->id}"
            )
            ->assertNotFound();
    }

    public function test_create_task_from_template_requires_write_ability(): void
    {
        $template = TaskTemplate::factory()->create([
            'team_id' => $this->team->id,
            'created_by' => $this->user->id,
        ]);
        $token = $this->user->createToken('read-only', ['read'])->plainTextToken;

        $this->api($token)
            ->postJson(
                "/api/v1/teams/{$this->team->id}/boards/{$this->board->id}/columns/{$this->column->id}/tasks/from-template/{$template->id}"
            )
            ->assertForbidden();
    }
}
