<?php

namespace Tests\Feature;

use App\Models\AutomationRule;
use App\Models\Board;
use App\Models\Column;
use App\Models\Team;
use App\Models\TeamMember;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AutomationRuleControllerTest extends TestCase
{
    use RefreshDatabase;

    private User $owner;

    private User $member;

    private Team $team;

    private Board $board;

    private Column $todo;

    private Column $review;

    private AutomationRule $rule;

    protected function setUp(): void
    {
        parent::setUp();

        $this->owner = User::factory()->create();
        $this->member = User::factory()->create();
        $this->team = Team::factory()->create();
        TeamMember::create(['team_id' => $this->team->id, 'user_id' => $this->owner->id, 'role' => 'owner']);
        TeamMember::create(['team_id' => $this->team->id, 'user_id' => $this->member->id, 'role' => 'member']);
        $this->board = Board::factory()->create(['team_id' => $this->team->id]);
        $this->todo = Column::factory()->create(['board_id' => $this->board->id]);
        $this->review = Column::factory()->create(['board_id' => $this->board->id]);

        $this->rule = AutomationRule::create([
            'board_id' => $this->board->id,
            'name' => 'Auto-assign reviewer',
            'trigger_type' => 'task_moved',
            'trigger_config' => ['to_column_id' => $this->review->id],
            'action_type' => 'assign_user',
            'action_config' => ['user_id' => $this->owner->id],
            'is_active' => true,
        ]);
    }

    private function updateUrl(?AutomationRule $rule = null, ?Board $board = null): string
    {
        return route('boards.automation-rules.update', [$this->team, $board ?? $this->board, $rule ?? $this->rule]);
    }

    public function test_admin_can_edit_every_part_of_a_rule(): void
    {
        $response = $this->actingAs($this->owner)->putJson($this->updateUrl(), [
            'name' => 'Move reviewed work back',
            'trigger_type' => 'task_moved',
            'trigger_config' => ['from_column_id' => $this->review->id],
            'action_type' => 'move_to_column',
            'action_config' => ['column_id' => $this->todo->id],
        ]);

        $response->assertOk();

        $this->rule->refresh();
        $this->assertSame('Move reviewed work back', $this->rule->name);
        $this->assertSame(['from_column_id' => $this->review->id], $this->rule->trigger_config);
        $this->assertSame('move_to_column', $this->rule->action_type);
        $this->assertSame(['column_id' => $this->todo->id], $this->rule->action_config);
    }

    public function test_update_returns_validation_errors_for_a_column_on_another_board(): void
    {
        $foreign = Column::factory()->create([
            'board_id' => Board::factory()->create(['team_id' => $this->team->id])->id,
        ]);

        $this->actingAs($this->owner)
            ->putJson($this->updateUrl(), [
                'action_type' => 'move_to_column',
                'action_config' => ['column_id' => $foreign->id],
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors('action_config.column_id');

        $this->assertSame('assign_user', $this->rule->fresh()->action_type);
    }

    public function test_members_cannot_update_rules(): void
    {
        $this->actingAs($this->member)
            ->putJson($this->updateUrl(), ['name' => 'Hijacked', 'is_active' => false])
            ->assertForbidden();

        $this->assertSame('Auto-assign reviewer', $this->rule->fresh()->name);
        $this->assertTrue($this->rule->fresh()->is_active);
    }

    public function test_members_cannot_delete_rules(): void
    {
        $this->actingAs($this->member)
            ->deleteJson(route('boards.automation-rules.destroy', [$this->team, $this->board, $this->rule]))
            ->assertForbidden();

        $this->assertDatabaseHas('automation_rules', ['id' => $this->rule->id]);
    }

    public function test_outsiders_cannot_update_or_delete_rules(): void
    {
        $outsider = User::factory()->create();

        $this->actingAs($outsider)
            ->putJson($this->updateUrl(), ['name' => 'Hijacked'])
            ->assertForbidden();
        $this->actingAs($outsider)
            ->deleteJson(route('boards.automation-rules.destroy', [$this->team, $this->board, $this->rule]))
            ->assertForbidden();

        $this->assertDatabaseHas('automation_rules', ['id' => $this->rule->id, 'name' => 'Auto-assign reviewer']);
    }

    public function test_a_rule_cannot_be_changed_through_another_boards_url(): void
    {
        $otherBoard = Board::factory()->create(['team_id' => $this->team->id]);

        $this->actingAs($this->owner)
            ->putJson($this->updateUrl(board: $otherBoard), ['name' => 'Wrong board'])
            ->assertNotFound();
        $this->actingAs($this->owner)
            ->deleteJson(route('boards.automation-rules.destroy', [$this->team, $otherBoard, $this->rule]))
            ->assertNotFound();

        $this->assertDatabaseHas('automation_rules', ['id' => $this->rule->id, 'name' => 'Auto-assign reviewer']);
    }
}
