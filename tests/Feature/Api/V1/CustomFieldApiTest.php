<?php

namespace Tests\Feature\Api\V1;

use App\Models\Board;
use App\Models\BoardCustomField;
use App\Models\Column;
use App\Models\Task;
use App\Models\Team;
use App\Models\TeamMember;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CustomFieldApiTest extends TestCase
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
        TeamMember::create(['team_id' => $this->team->id, 'user_id' => $this->user->id, 'role' => 'owner']);
        $this->board = Board::factory()->create(['team_id' => $this->team->id]);
        $this->column = Column::factory()->create(['board_id' => $this->board->id]);
    }

    /**
     * @param  array<int, string>  $abilities
     */
    private function api(array $abilities = ['read', 'write', 'manage'], ?User $user = null): static
    {
        $token = ($user ?? $this->user)->createToken('test', $abilities)->plainTextToken;

        return $this->withHeader('Authorization', "Bearer {$token}");
    }

    private function url(string $suffix = ''): string
    {
        return "/api/v1/teams/{$this->team->id}/boards/{$this->board->id}/custom-fields{$suffix}";
    }

    public function test_list_fields_with_read_token(): void
    {
        $b = BoardCustomField::factory()->create(['board_id' => $this->board->id, 'sort_order' => 1]);
        $a = BoardCustomField::factory()->withOptions()->create(['board_id' => $this->board->id, 'sort_order' => 0]);
        BoardCustomField::factory()->create(); // another board

        $this->api(['read'])->getJson($this->url())
            ->assertOk()
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('data.0.id', $a->id)
            ->assertJsonPath('data.0.type', 'select')
            ->assertJsonPath('data.0.options.0.id', 'opt-1')
            ->assertJsonPath('data.1.id', $b->id);
    }

    public function test_board_show_includes_custom_fields(): void
    {
        $field = BoardCustomField::factory()->create(['board_id' => $this->board->id]);

        $this->api(['read'])->getJson("/api/v1/teams/{$this->team->id}/boards/{$this->board->id}")
            ->assertOk()
            ->assertJsonPath('data.custom_fields.0.id', $field->id);
    }

    public function test_create_field(): void
    {
        $this->api()->postJson($this->url(), [
            'name' => 'Severity',
            'type' => 'multi_select',
            'show_on_card' => true,
            'options' => [['label' => 'UI', 'color' => '#3b82f6'], ['label' => 'API']],
        ])
            ->assertCreated()
            ->assertJsonPath('data.name', 'Severity')
            ->assertJsonPath('data.type', 'multi_select')
            ->assertJsonPath('data.show_on_card', true)
            ->assertJsonPath('data.options.1.label', 'API')
            ->assertJsonPath('data.options.1.color', '#64748b');
    }

    public function test_create_requires_manage_ability(): void
    {
        $this->api(['read', 'write'])->postJson($this->url(), ['name' => 'X', 'type' => 'text'])
            ->assertForbidden();

        $this->assertDatabaseCount('board_custom_fields', 0);
    }

    public function test_member_cannot_create_even_with_manage_token(): void
    {
        $member = User::factory()->create();
        TeamMember::create(['team_id' => $this->team->id, 'user_id' => $member->id, 'role' => 'member']);

        $this->api(user: $member)->postJson($this->url(), ['name' => 'X', 'type' => 'text'])
            ->assertForbidden();
    }

    public function test_validation_errors_are_returned(): void
    {
        $this->api()->postJson($this->url(), ['name' => '', 'type' => 'select'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['name', 'options']);
    }

    public function test_update_field(): void
    {
        $field = BoardCustomField::factory()->withOptions()->create(['board_id' => $this->board->id]);

        $this->api()->putJson($this->url("/{$field->id}"), [
            'name' => 'Impact',
            'options' => [['id' => 'opt-2', 'label' => 'Medium'], ['label' => 'Critical']],
        ])
            ->assertOk()
            ->assertJsonPath('data.name', 'Impact')
            ->assertJsonPath('data.options.0.id', 'opt-2')
            ->assertJsonCount(2, 'data.options');
    }

    public function test_update_requires_manage_ability(): void
    {
        $field = BoardCustomField::factory()->create(['board_id' => $this->board->id]);

        $this->api(['read', 'write'])->putJson($this->url("/{$field->id}"), ['name' => 'Nope'])
            ->assertForbidden();
    }

    public function test_update_field_on_other_board_is_not_found(): void
    {
        $foreign = BoardCustomField::factory()->create();

        $this->api()->putJson($this->url("/{$foreign->id}"), ['name' => 'Nope'])
            ->assertNotFound();
    }

    public function test_reorder_fields(): void
    {
        $a = BoardCustomField::factory()->create(['board_id' => $this->board->id, 'sort_order' => 0]);
        $b = BoardCustomField::factory()->create(['board_id' => $this->board->id, 'sort_order' => 1]);

        $this->api()->putJson($this->url(), ['field_ids' => [$b->id, $a->id]])
            ->assertOk()
            ->assertJsonPath('data.0.id', $b->id)
            ->assertJsonPath('data.1.id', $a->id);
    }

    public function test_reorder_requires_manage_ability(): void
    {
        $a = BoardCustomField::factory()->create(['board_id' => $this->board->id]);

        $this->api(['read', 'write'])->putJson($this->url(), ['field_ids' => [$a->id]])
            ->assertForbidden();
    }

    public function test_delete_field_clears_values(): void
    {
        $field = BoardCustomField::factory()->create(['board_id' => $this->board->id]);
        $task = Task::factory()->create([
            'board_id' => $this->board->id,
            'column_id' => $this->column->id,
            'custom_fields' => [$field->id => 'x'],
        ]);

        $this->api()->deleteJson($this->url("/{$field->id}"))->assertNoContent();

        $this->assertDatabaseMissing('board_custom_fields', ['id' => $field->id]);
        $this->assertNull($task->fresh()->custom_fields);
    }

    public function test_delete_requires_manage_ability(): void
    {
        $field = BoardCustomField::factory()->create(['board_id' => $this->board->id]);

        $this->api(['read', 'write'])->deleteJson($this->url("/{$field->id}"))->assertForbidden();

        $this->assertDatabaseHas('board_custom_fields', ['id' => $field->id]);
    }

    public function test_task_api_sets_validates_and_returns_values(): void
    {
        $number = BoardCustomField::factory()->ofType('number')->create(['board_id' => $this->board->id]);
        $text = BoardCustomField::factory()->create(['board_id' => $this->board->id]);
        $tasksUrl = "/api/v1/teams/{$this->team->id}/boards/{$this->board->id}";

        $created = $this->api(['read', 'write'])->postJson("{$tasksUrl}/columns/{$this->column->id}/tasks", [
            'title' => 'From API',
            'custom_fields' => [$number->id => 8, $text->id => 'hello'],
        ])
            ->assertCreated()
            ->assertJsonPath("data.custom_fields.{$number->id}", 8)
            ->json('data');

        // Partial update keeps the other value
        $this->api(['read', 'write'])->putJson("{$tasksUrl}/tasks/{$created['id']}", [
            'custom_fields' => [$number->id => 13],
        ])
            ->assertOk()
            ->assertJsonPath("data.custom_fields.{$number->id}", 13)
            ->assertJsonPath("data.custom_fields.{$text->id}", 'hello');

        $this->api(['read', 'write'])->putJson("{$tasksUrl}/tasks/{$created['id']}", [
            'custom_fields' => [$number->id => 'lots'],
        ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors("custom_fields.{$number->id}");

        $this->api(['read'])->getJson("{$tasksUrl}/tasks/{$created['id']}")
            ->assertOk()
            ->assertJsonPath("data.custom_fields.{$number->id}", 13);

        $this->api(['read'])->getJson("{$tasksUrl}/tasks")
            ->assertOk()
            ->assertJsonPath("data.0.custom_fields.{$text->id}", 'hello');
    }
}
