<?php

namespace Tests\Feature;

use App\Models\AutomationRule;
use App\Models\Board;
use App\Models\Column;
use App\Models\SavedFilter;
use App\Models\Team;
use App\Models\TeamMember;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AutomationFilterTest extends TestCase
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
        $this->addTeamMember($this->user, $this->team, 'owner');
        $this->board = Board::factory()->create(['team_id' => $this->team->id]);
        $this->column = Column::factory()->create(['board_id' => $this->board->id]);
    }

    private function addTeamMember(User $user, Team $team, string $role = 'member'): void
    {
        TeamMember::create([
            'team_id' => $team->id,
            'user_id' => $user->id,
            'role' => $role,
        ]);
    }

    // ──────────────────────────────────────────────
    // AutomationRuleController Tests
    // ──────────────────────────────────────────────

    public function test_can_list_automation_rules(): void
    {
        AutomationRule::create([
            'board_id' => $this->board->id,
            'name' => 'Auto move on merge',
            'trigger_type' => 'gitlab_mr_merged',
            'trigger_config' => [],
            'action_type' => 'move_to_column',
            'action_config' => ['column_id' => $this->column->id],
            'is_active' => true,
        ]);

        AutomationRule::create([
            'board_id' => $this->board->id,
            'name' => 'Notify on assign',
            'trigger_type' => 'task_assigned',
            'trigger_config' => [],
            'action_type' => 'send_notification',
            'action_config' => [],
            'is_active' => true,
        ]);

        $response = $this->actingAs($this->user)->getJson(
            route('boards.automation-rules.index', [$this->team, $this->board])
        );

        $response->assertOk();
        $response->assertJsonCount(2);
        $response->assertJsonFragment(['name' => 'Auto move on merge']);
        $response->assertJsonFragment(['name' => 'Notify on assign']);
    }

    public function test_can_create_automation_rule(): void
    {
        $response = $this->actingAs($this->user)->postJson(
            route('boards.automation-rules.store', [$this->team, $this->board]),
            [
                'name' => 'Move to Done on MR merge',
                'trigger_type' => 'gitlab_mr_merged',
                'trigger_config' => ['source_branch_pattern' => 'feature/*'],
                'action_type' => 'move_to_column',
                'action_config' => ['column_id' => $this->column->id],
            ]
        );

        $response->assertCreated();
        $response->assertJsonFragment(['name' => 'Move to Done on MR merge']);
        $response->assertJsonFragment(['is_active' => true]);

        $this->assertDatabaseHas('automation_rules', [
            'board_id' => $this->board->id,
            'name' => 'Move to Done on MR merge',
            'trigger_type' => 'gitlab_mr_merged',
            'action_type' => 'move_to_column',
        ]);
    }

    public function test_cannot_create_rule_with_cross_team_trigger_target(): void
    {
        $outsider = User::factory()->create();

        $response = $this->actingAs($this->user)->postJson(
            route('boards.automation-rules.store', [$this->team, $this->board]),
            [
                'name' => 'Invalid trigger target',
                'trigger_type' => 'task_assigned',
                'trigger_config' => ['user_id' => $outsider->id],
                'action_type' => 'move_to_column',
                'action_config' => ['column_id' => $this->column->id],
            ]
        );

        $response->assertStatus(422);
        $response->assertJsonValidationErrors('trigger_config.user_id');
    }

    public function test_cannot_create_rule_with_cross_team_action_target(): void
    {
        $otherTeam = Team::factory()->create();
        $otherBoard = Board::factory()->create(['team_id' => $otherTeam->id]);
        $otherColumn = Column::factory()->create(['board_id' => $otherBoard->id]);

        $response = $this->actingAs($this->user)->postJson(
            route('boards.automation-rules.store', [$this->team, $this->board]),
            [
                'name' => 'Invalid action target',
                'trigger_type' => 'task_created',
                'action_type' => 'move_to_column',
                'action_config' => ['column_id' => $otherColumn->id],
            ]
        );

        $response->assertStatus(422);
        $response->assertJsonValidationErrors('action_config.column_id');
    }

    public function test_can_update_automation_rule(): void
    {
        $rule = AutomationRule::create([
            'board_id' => $this->board->id,
            'name' => 'Original rule',
            'trigger_type' => 'task_moved',
            'trigger_config' => [],
            'action_type' => 'add_label',
            'action_config' => [],
            'is_active' => true,
        ]);

        $response = $this->actingAs($this->user)->putJson(
            route('boards.automation-rules.update', [$this->team, $this->board, $rule]),
            [
                'name' => 'Updated rule',
                'is_active' => false,
            ]
        );

        $response->assertOk();
        $response->assertJsonFragment(['name' => 'Updated rule']);
        $response->assertJsonFragment(['is_active' => false]);

        $rule->refresh();
        $this->assertEquals('Updated rule', $rule->name);
        $this->assertFalse($rule->is_active);
    }

    public function test_can_delete_automation_rule(): void
    {
        $rule = AutomationRule::create([
            'board_id' => $this->board->id,
            'name' => 'Rule to delete',
            'trigger_type' => 'task_created',
            'trigger_config' => [],
            'action_type' => 'assign_user',
            'action_config' => [],
            'is_active' => true,
        ]);

        $response = $this->actingAs($this->user)->deleteJson(
            route('boards.automation-rules.destroy', [$this->team, $this->board, $rule])
        );

        $response->assertOk();
        $response->assertJsonFragment(['message' => 'Automation rule deleted']);
        $this->assertDatabaseMissing('automation_rules', ['id' => $rule->id]);
    }

    // ──────────────────────────────────────────────
    // SavedFilterController Tests
    // ──────────────────────────────────────────────

    public function test_can_list_saved_filters(): void
    {
        SavedFilter::create([
            'board_id' => $this->board->id,
            'user_id' => $this->user->id,
            'name' => 'My urgent tasks',
            'filter_config' => ['priority' => 'urgent'],
            'is_default' => false,
        ]);

        SavedFilter::create([
            'board_id' => $this->board->id,
            'user_id' => $this->user->id,
            'name' => 'Assigned to me',
            'filter_config' => ['assignee' => 'me'],
            'is_default' => false,
        ]);

        $response = $this->actingAs($this->user)->getJson(
            route('boards.filters.index', [$this->team, $this->board])
        );

        $response->assertOk();
        $response->assertJsonCount(2);
        $response->assertJsonFragment(['name' => 'Assigned to me']);
        $response->assertJsonFragment(['name' => 'My urgent tasks']);
    }

    public function test_can_create_saved_filter(): void
    {
        $response = $this->actingAs($this->user)->postJson(
            route('boards.filters.store', [$this->team, $this->board]),
            [
                'name' => 'High priority',
                'filter_config' => ['priority' => 'high', 'status' => 'open'],
                'is_default' => true,
            ]
        );

        $response->assertCreated();
        $response->assertJsonFragment(['name' => 'High priority']);
        $response->assertJsonFragment(['is_default' => true]);

        $this->assertDatabaseHas('saved_filters', [
            'board_id' => $this->board->id,
            'user_id' => $this->user->id,
            'name' => 'High priority',
            'is_default' => true,
        ]);
    }

    public function test_can_update_saved_filter(): void
    {
        $filter = SavedFilter::create([
            'board_id' => $this->board->id,
            'user_id' => $this->user->id,
            'name' => 'Original filter',
            'filter_config' => ['priority' => 'low'],
            'is_default' => false,
        ]);

        $response = $this->actingAs($this->user)->putJson(
            route('boards.filters.update', [$this->team, $this->board, $filter]),
            [
                'name' => 'Updated filter',
                'filter_config' => ['priority' => 'high'],
                'is_default' => true,
            ]
        );

        $response->assertOk();
        $response->assertJsonFragment(['name' => 'Updated filter']);

        $filter->refresh();
        $this->assertEquals('Updated filter', $filter->name);
        $this->assertTrue($filter->is_default);
    }

    public function test_can_delete_saved_filter(): void
    {
        $filter = SavedFilter::create([
            'board_id' => $this->board->id,
            'user_id' => $this->user->id,
            'name' => 'Filter to delete',
            'filter_config' => ['label' => 'bug'],
            'is_default' => false,
        ]);

        $response = $this->actingAs($this->user)->deleteJson(
            route('boards.filters.destroy', [$this->team, $this->board, $filter])
        );

        $response->assertOk();
        $response->assertJsonFragment(['message' => 'Deleted']);
        $this->assertDatabaseMissing('saved_filters', ['id' => $filter->id]);
    }
}
