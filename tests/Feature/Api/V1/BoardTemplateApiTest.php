<?php

namespace Tests\Feature\Api\V1;

use App\Models\Board;
use App\Models\BoardTemplate;
use App\Models\Column;
use App\Models\Team;
use App\Models\TeamMember;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class BoardTemplateApiTest extends TestCase
{
    use RefreshDatabase;

    private User $user;

    private Team $team;

    private string $token;

    protected function setUp(): void
    {
        parent::setUp();

        $this->user = User::factory()->create();
        $this->team = Team::factory()->create();
        TeamMember::create(['team_id' => $this->team->id, 'user_id' => $this->user->id, 'role' => 'owner']);
        $this->token = $this->user->createToken('test', ['read', 'write', 'manage'])->plainTextToken;
    }

    private function api(): static
    {
        return $this->withHeader('Authorization', "Bearer {$this->token}");
    }

    private function makeTemplate(?User $creator = null): BoardTemplate
    {
        return BoardTemplate::create([
            'name' => 'Sprint Template',
            'description' => 'A template',
            'created_by' => ($creator ?? $this->user)->id,
            'template_data' => [
                'columns' => [
                    ['name' => 'Backlog', 'color' => '#6366f1', 'wip_limit' => null, 'is_done_column' => false],
                    ['name' => 'Done', 'color' => '#22c55e', 'wip_limit' => null, 'is_done_column' => true],
                ],
            ],
        ]);
    }

    public function test_index_lists_only_own_templates(): void
    {
        $this->makeTemplate();
        $this->makeTemplate(User::factory()->create());

        $response = $this->api()->getJson('/api/v1/templates');

        $response->assertOk();
        $response->assertJsonCount(1, 'data');
        $response->assertJsonPath('data.0.creator.id', $this->user->id);
    }

    public function test_store_template(): void
    {
        $response = $this->api()->postJson('/api/v1/templates', [
            'name' => 'My Template',
            'description' => 'Great flow',
            'template_data' => [
                'columns' => [
                    ['name' => 'To Do', 'color' => '#6366f1', 'is_done_column' => false],
                    ['name' => 'Done', 'color' => '#22c55e', 'wip_limit' => 5, 'is_done_column' => true],
                ],
            ],
        ]);

        $response->assertCreated();
        $response->assertJsonPath('data.name', 'My Template');
        $response->assertJsonPath('data.creator.id', $this->user->id);
        $this->assertDatabaseHas('board_templates', ['name' => 'My Template', 'created_by' => $this->user->id]);
    }

    public function test_store_template_requires_columns(): void
    {
        $response = $this->api()->postJson('/api/v1/templates', [
            'name' => 'Broken',
            'template_data' => ['columns' => []],
        ]);

        $response->assertUnprocessable();
        $response->assertJsonValidationErrors(['template_data.columns']);
    }

    public function test_store_template_requires_write_ability(): void
    {
        $readToken = $this->user->createToken('read-only', ['read'])->plainTextToken;

        $response = $this->withHeader('Authorization', "Bearer {$readToken}")->postJson('/api/v1/templates', [
            'name' => 'Nope',
            'template_data' => ['columns' => [['name' => 'A', 'color' => '#000000', 'is_done_column' => false]]],
        ]);

        $response->assertForbidden();
    }

    public function test_destroy_own_template(): void
    {
        $template = $this->makeTemplate();

        $response = $this->api()->deleteJson("/api/v1/templates/{$template->id}");

        $response->assertNoContent();
        $this->assertDatabaseMissing('board_templates', ['id' => $template->id]);
    }

    public function test_cannot_destroy_another_users_template(): void
    {
        $template = $this->makeTemplate(User::factory()->create());

        $response = $this->api()->deleteJson("/api/v1/templates/{$template->id}");

        $response->assertForbidden();
        $this->assertDatabaseHas('board_templates', ['id' => $template->id]);
    }

    public function test_create_template_from_board(): void
    {
        $board = Board::factory()->create(['team_id' => $this->team->id, 'name' => 'Release']);
        Column::factory()->create(['board_id' => $board->id, 'name' => 'Doing', 'sort_order' => 0]);
        Column::factory()->create(['board_id' => $board->id, 'name' => 'Shipped', 'sort_order' => 1, 'is_done_column' => true]);

        $response = $this->api()->postJson(
            "/api/v1/teams/{$this->team->id}/boards/{$board->id}/create-template"
        );

        $response->assertCreated();
        $response->assertJsonPath('data.name', 'Release Template');
        $response->assertJsonCount(2, 'data.template_data.columns');
        $response->assertJsonPath('data.template_data.columns.0.name', 'Doing');
        $response->assertJsonPath('data.template_data.columns.1.is_done_column', true);
    }

    public function test_create_template_from_board_requires_write_ability(): void
    {
        $board = Board::factory()->create(['team_id' => $this->team->id]);
        $readToken = $this->user->createToken('read-only', ['read'])->plainTextToken;

        $response = $this->withHeader('Authorization', "Bearer {$readToken}")->postJson(
            "/api/v1/teams/{$this->team->id}/boards/{$board->id}/create-template"
        );

        $response->assertForbidden();
    }

    public function test_create_board_from_template(): void
    {
        $template = $this->makeTemplate();

        $response = $this->api()->postJson(
            "/api/v1/teams/{$this->team->id}/templates/{$template->id}/create-board",
            ['name' => 'Sprint 12', 'description' => 'From template']
        );

        $response->assertCreated();
        $response->assertJsonPath('data.name', 'Sprint 12');
        $response->assertJsonCount(2, 'data.columns');
        $response->assertJsonPath('data.columns.0.name', 'Backlog');
        $this->assertDatabaseHas('boards', ['name' => 'Sprint 12', 'team_id' => $this->team->id]);
    }

    public function test_create_board_from_template_requires_manage_ability(): void
    {
        $template = $this->makeTemplate();
        $writeToken = $this->user->createToken('write-only', ['read', 'write'])->plainTextToken;

        $response = $this->withHeader('Authorization', "Bearer {$writeToken}")->postJson(
            "/api/v1/teams/{$this->team->id}/templates/{$template->id}/create-board",
            ['name' => 'Nope']
        );

        $response->assertForbidden();
    }

    public function test_regular_member_cannot_create_board_from_template(): void
    {
        $member = User::factory()->create();
        TeamMember::create(['team_id' => $this->team->id, 'user_id' => $member->id, 'role' => 'member']);
        $memberToken = $member->createToken('member', ['read', 'write', 'manage'])->plainTextToken;
        $template = $this->makeTemplate($member);

        $response = $this->withHeader('Authorization', "Bearer {$memberToken}")->postJson(
            "/api/v1/teams/{$this->team->id}/templates/{$template->id}/create-board",
            ['name' => 'Nope']
        );

        $response->assertForbidden();
    }

    public function test_cannot_create_board_from_another_users_template(): void
    {
        $template = $this->makeTemplate(User::factory()->create());

        $response = $this->api()->postJson(
            "/api/v1/teams/{$this->team->id}/templates/{$template->id}/create-board",
            ['name' => 'Nope']
        );

        $response->assertForbidden();
    }
}
