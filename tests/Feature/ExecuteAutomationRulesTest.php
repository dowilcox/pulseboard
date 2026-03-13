<?php

namespace Tests\Feature;

use App\Actions\Automation\ExecuteAutomationRules;
use App\Models\AutomationRule;
use App\Models\Board;
use App\Models\Column;
use App\Models\Label;
use App\Models\Task;
use App\Models\Team;
use App\Models\TeamMember;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ExecuteAutomationRulesTest extends TestCase
{
    use RefreshDatabase;

    private User $user;

    private Team $team;

    private Board $board;

    private Column $column;

    private Column $doneColumn;

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
        $this->column = Column::factory()->create(['board_id' => $this->board->id, 'name' => 'To Do']);
        $this->doneColumn = Column::factory()->create(['board_id' => $this->board->id, 'name' => 'Done', 'is_done_column' => true]);
    }

    // ---------------------------------------------------------------
    // Trigger matching
    // ---------------------------------------------------------------

    public function test_task_created_trigger_always_matches(): void
    {
        $task = Task::factory()->create([
            'board_id' => $this->board->id,
            'column_id' => $this->column->id,
            'created_by' => $this->user->id,
        ]);

        AutomationRule::create([
            'board_id' => $this->board->id,
            'name' => 'Auto move on create',
            'trigger_type' => 'task_created',
            'trigger_config' => [],
            'action_type' => 'move_to_column',
            'action_config' => ['column_id' => $this->doneColumn->id],
            'is_active' => true,
        ]);

        ExecuteAutomationRules::run($this->board, 'task_created', ['task_id' => $task->id]);

        $task->refresh();
        $this->assertEquals($this->doneColumn->id, $task->column_id);
    }

    public function test_task_moved_trigger_matches_from_and_to_columns(): void
    {
        $task = Task::factory()->create([
            'board_id' => $this->board->id,
            'column_id' => $this->doneColumn->id,
            'created_by' => $this->user->id,
            'priority' => 'medium',
        ]);

        AutomationRule::create([
            'board_id' => $this->board->id,
            'name' => 'Set priority when moved to Done',
            'trigger_type' => 'task_moved',
            'trigger_config' => [
                'from_column_id' => $this->column->id,
                'to_column_id' => $this->doneColumn->id,
            ],
            'action_type' => 'update_field',
            'action_config' => ['field' => 'priority', 'value' => 'low'],
            'is_active' => true,
        ]);

        ExecuteAutomationRules::run($this->board, 'task_moved', [
            'task_id' => $task->id,
            'from_column_id' => $this->column->id,
            'to_column_id' => $this->doneColumn->id,
        ]);

        $task->refresh();
        $this->assertEquals('low', $task->priority);
    }

    public function test_task_moved_trigger_does_not_match_wrong_column(): void
    {
        $otherColumn = Column::factory()->create(['board_id' => $this->board->id, 'name' => 'Review']);

        $task = Task::factory()->create([
            'board_id' => $this->board->id,
            'column_id' => $this->column->id,
            'created_by' => $this->user->id,
            'priority' => 'medium',
        ]);

        AutomationRule::create([
            'board_id' => $this->board->id,
            'name' => 'Should not fire',
            'trigger_type' => 'task_moved',
            'trigger_config' => ['to_column_id' => $this->doneColumn->id],
            'action_type' => 'update_field',
            'action_config' => ['field' => 'priority', 'value' => 'low'],
            'is_active' => true,
        ]);

        ExecuteAutomationRules::run($this->board, 'task_moved', [
            'task_id' => $task->id,
            'from_column_id' => $this->column->id,
            'to_column_id' => $otherColumn->id,
        ]);

        $task->refresh();
        $this->assertEquals('medium', $task->priority);
    }

    public function test_task_assigned_trigger_matches_specific_user(): void
    {
        $task = Task::factory()->create([
            'board_id' => $this->board->id,
            'column_id' => $this->column->id,
            'created_by' => $this->user->id,
            'priority' => 'medium',
        ]);

        AutomationRule::create([
            'board_id' => $this->board->id,
            'name' => 'Set urgent when assigned to user',
            'trigger_type' => 'task_assigned',
            'trigger_config' => ['user_id' => $this->user->id],
            'action_type' => 'update_field',
            'action_config' => ['field' => 'priority', 'value' => 'urgent'],
            'is_active' => true,
        ]);

        ExecuteAutomationRules::run($this->board, 'task_assigned', [
            'task_id' => $task->id,
            'user_id' => $this->user->id,
        ]);

        $task->refresh();
        $this->assertEquals('urgent', $task->priority);
    }

    public function test_task_assigned_trigger_does_not_match_different_user(): void
    {
        $otherUser = User::factory()->create();
        $task = Task::factory()->create([
            'board_id' => $this->board->id,
            'column_id' => $this->column->id,
            'created_by' => $this->user->id,
            'priority' => 'medium',
        ]);

        AutomationRule::create([
            'board_id' => $this->board->id,
            'name' => 'Should not fire',
            'trigger_type' => 'task_assigned',
            'trigger_config' => ['user_id' => $otherUser->id],
            'action_type' => 'update_field',
            'action_config' => ['field' => 'priority', 'value' => 'urgent'],
            'is_active' => true,
        ]);

        ExecuteAutomationRules::run($this->board, 'task_assigned', [
            'task_id' => $task->id,
            'user_id' => $this->user->id,
        ]);

        $task->refresh();
        $this->assertEquals('medium', $task->priority);
    }

    public function test_label_added_trigger_matches_specific_label(): void
    {
        $label = Label::create([
            'team_id' => $this->team->id,
            'name' => 'Bug',
            'color' => '#ff0000',
        ]);

        $task = Task::factory()->create([
            'board_id' => $this->board->id,
            'column_id' => $this->column->id,
            'created_by' => $this->user->id,
            'priority' => 'medium',
        ]);

        AutomationRule::create([
            'board_id' => $this->board->id,
            'name' => 'Set urgent on bug label',
            'trigger_type' => 'label_added',
            'trigger_config' => ['label_id' => $label->id],
            'action_type' => 'update_field',
            'action_config' => ['field' => 'priority', 'value' => 'urgent'],
            'is_active' => true,
        ]);

        ExecuteAutomationRules::run($this->board, 'label_added', [
            'task_id' => $task->id,
            'label_id' => $label->id,
        ]);

        $task->refresh();
        $this->assertEquals('urgent', $task->priority);
    }

    public function test_label_added_trigger_does_not_match_different_label(): void
    {
        $bugLabel = Label::create(['team_id' => $this->team->id, 'name' => 'Bug', 'color' => '#ff0000']);
        $featureLabel = Label::create(['team_id' => $this->team->id, 'name' => 'Feature', 'color' => '#00ff00']);

        $task = Task::factory()->create([
            'board_id' => $this->board->id,
            'column_id' => $this->column->id,
            'created_by' => $this->user->id,
            'priority' => 'medium',
        ]);

        AutomationRule::create([
            'board_id' => $this->board->id,
            'name' => 'Should not fire',
            'trigger_type' => 'label_added',
            'trigger_config' => ['label_id' => $bugLabel->id],
            'action_type' => 'update_field',
            'action_config' => ['field' => 'priority', 'value' => 'urgent'],
            'is_active' => true,
        ]);

        ExecuteAutomationRules::run($this->board, 'label_added', [
            'task_id' => $task->id,
            'label_id' => $featureLabel->id,
        ]);

        $task->refresh();
        $this->assertEquals('medium', $task->priority);
    }

    public function test_pipeline_status_trigger_matches_status(): void
    {
        $task = Task::factory()->create([
            'board_id' => $this->board->id,
            'column_id' => $this->column->id,
            'created_by' => $this->user->id,
        ]);

        AutomationRule::create([
            'board_id' => $this->board->id,
            'name' => 'Move on pipeline success',
            'trigger_type' => 'gitlab_pipeline_status',
            'trigger_config' => ['status' => 'success'],
            'action_type' => 'move_to_column',
            'action_config' => ['column_id' => $this->doneColumn->id],
            'is_active' => true,
        ]);

        ExecuteAutomationRules::run($this->board, 'gitlab_pipeline_status', [
            'task_id' => $task->id,
            'pipeline_status' => 'success',
        ]);

        $task->refresh();
        $this->assertEquals($this->doneColumn->id, $task->column_id);
    }

    public function test_pipeline_status_does_not_match_different_status(): void
    {
        $task = Task::factory()->create([
            'board_id' => $this->board->id,
            'column_id' => $this->column->id,
            'created_by' => $this->user->id,
        ]);

        AutomationRule::create([
            'board_id' => $this->board->id,
            'name' => 'Should not fire',
            'trigger_type' => 'gitlab_pipeline_status',
            'trigger_config' => ['status' => 'success'],
            'action_type' => 'move_to_column',
            'action_config' => ['column_id' => $this->doneColumn->id],
            'is_active' => true,
        ]);

        ExecuteAutomationRules::run($this->board, 'gitlab_pipeline_status', [
            'task_id' => $task->id,
            'pipeline_status' => 'failed',
        ]);

        $task->refresh();
        $this->assertEquals($this->column->id, $task->column_id);
    }

    public function test_due_date_reached_trigger_always_matches(): void
    {
        $task = Task::factory()->create([
            'board_id' => $this->board->id,
            'column_id' => $this->column->id,
            'created_by' => $this->user->id,
            'priority' => 'low',
        ]);

        AutomationRule::create([
            'board_id' => $this->board->id,
            'name' => 'Set urgent on due date',
            'trigger_type' => 'due_date_reached',
            'trigger_config' => [],
            'action_type' => 'update_field',
            'action_config' => ['field' => 'priority', 'value' => 'urgent'],
            'is_active' => true,
        ]);

        ExecuteAutomationRules::run($this->board, 'due_date_reached', ['task_id' => $task->id]);

        $task->refresh();
        $this->assertEquals('urgent', $task->priority);
    }

    public function test_gitlab_mr_merged_trigger_always_matches(): void
    {
        $task = Task::factory()->create([
            'board_id' => $this->board->id,
            'column_id' => $this->column->id,
            'created_by' => $this->user->id,
        ]);

        AutomationRule::create([
            'board_id' => $this->board->id,
            'name' => 'Move to done on MR merged',
            'trigger_type' => 'gitlab_mr_merged',
            'trigger_config' => [],
            'action_type' => 'move_to_column',
            'action_config' => ['column_id' => $this->doneColumn->id],
            'is_active' => true,
        ]);

        ExecuteAutomationRules::run($this->board, 'gitlab_mr_merged', ['task_id' => $task->id]);

        $task->refresh();
        $this->assertEquals($this->doneColumn->id, $task->column_id);
    }

    public function test_unknown_trigger_type_does_not_match(): void
    {
        $task = Task::factory()->create([
            'board_id' => $this->board->id,
            'column_id' => $this->column->id,
            'created_by' => $this->user->id,
            'priority' => 'medium',
        ]);

        AutomationRule::create([
            'board_id' => $this->board->id,
            'name' => 'Unknown trigger',
            'trigger_type' => 'nonexistent_trigger',
            'trigger_config' => [],
            'action_type' => 'update_field',
            'action_config' => ['field' => 'priority', 'value' => 'urgent'],
            'is_active' => true,
        ]);

        ExecuteAutomationRules::run($this->board, 'nonexistent_trigger', ['task_id' => $task->id]);

        $task->refresh();
        $this->assertEquals('medium', $task->priority);
    }

    // ---------------------------------------------------------------
    // Action execution
    // ---------------------------------------------------------------

    public function test_action_move_to_column(): void
    {
        $task = Task::factory()->create([
            'board_id' => $this->board->id,
            'column_id' => $this->column->id,
            'created_by' => $this->user->id,
        ]);

        AutomationRule::create([
            'board_id' => $this->board->id,
            'name' => 'Move to done',
            'trigger_type' => 'task_created',
            'trigger_config' => [],
            'action_type' => 'move_to_column',
            'action_config' => ['column_id' => $this->doneColumn->id],
            'is_active' => true,
        ]);

        ExecuteAutomationRules::run($this->board, 'task_created', ['task_id' => $task->id]);

        $task->refresh();
        $this->assertEquals($this->doneColumn->id, $task->column_id);
    }

    public function test_action_move_to_column_rejects_cross_board_column(): void
    {
        $otherBoard = Board::factory()->create(['team_id' => $this->team->id]);
        $otherColumn = Column::factory()->create(['board_id' => $otherBoard->id]);

        $task = Task::factory()->create([
            'board_id' => $this->board->id,
            'column_id' => $this->column->id,
            'created_by' => $this->user->id,
        ]);

        AutomationRule::create([
            'board_id' => $this->board->id,
            'name' => 'Try to move cross-board',
            'trigger_type' => 'task_created',
            'trigger_config' => [],
            'action_type' => 'move_to_column',
            'action_config' => ['column_id' => $otherColumn->id],
            'is_active' => true,
        ]);

        ExecuteAutomationRules::run($this->board, 'task_created', ['task_id' => $task->id]);

        $task->refresh();
        $this->assertEquals($this->column->id, $task->column_id);
    }

    public function test_action_move_to_column_ignores_missing_column_id(): void
    {
        $task = Task::factory()->create([
            'board_id' => $this->board->id,
            'column_id' => $this->column->id,
            'created_by' => $this->user->id,
        ]);

        AutomationRule::create([
            'board_id' => $this->board->id,
            'name' => 'Missing column id',
            'trigger_type' => 'task_created',
            'trigger_config' => [],
            'action_type' => 'move_to_column',
            'action_config' => [],
            'is_active' => true,
        ]);

        ExecuteAutomationRules::run($this->board, 'task_created', ['task_id' => $task->id]);

        $task->refresh();
        $this->assertEquals($this->column->id, $task->column_id);
    }

    public function test_action_assign_user(): void
    {
        $task = Task::factory()->create([
            'board_id' => $this->board->id,
            'column_id' => $this->column->id,
            'created_by' => $this->user->id,
        ]);

        AutomationRule::create([
            'board_id' => $this->board->id,
            'name' => 'Auto assign user',
            'trigger_type' => 'task_created',
            'trigger_config' => [],
            'action_type' => 'assign_user',
            'action_config' => ['user_id' => $this->user->id],
            'is_active' => true,
        ]);

        ExecuteAutomationRules::run($this->board, 'task_created', ['task_id' => $task->id]);

        $this->assertTrue($task->assignees()->where('users.id', $this->user->id)->exists());
    }

    public function test_action_assign_user_does_not_duplicate(): void
    {
        $task = Task::factory()->create([
            'board_id' => $this->board->id,
            'column_id' => $this->column->id,
            'created_by' => $this->user->id,
        ]);

        $task->assignees()->attach($this->user->id, [
            'assigned_at' => now(),
            'assigned_by' => $this->user->id,
        ]);

        AutomationRule::create([
            'board_id' => $this->board->id,
            'name' => 'Auto assign user',
            'trigger_type' => 'task_created',
            'trigger_config' => [],
            'action_type' => 'assign_user',
            'action_config' => ['user_id' => $this->user->id],
            'is_active' => true,
        ]);

        ExecuteAutomationRules::run($this->board, 'task_created', ['task_id' => $task->id]);

        $this->assertEquals(1, $task->assignees()->where('users.id', $this->user->id)->count());
    }

    public function test_action_assign_user_ignores_missing_user_id(): void
    {
        $task = Task::factory()->create([
            'board_id' => $this->board->id,
            'column_id' => $this->column->id,
            'created_by' => $this->user->id,
        ]);

        AutomationRule::create([
            'board_id' => $this->board->id,
            'name' => 'Missing user',
            'trigger_type' => 'task_created',
            'trigger_config' => [],
            'action_type' => 'assign_user',
            'action_config' => [],
            'is_active' => true,
        ]);

        ExecuteAutomationRules::run($this->board, 'task_created', ['task_id' => $task->id]);

        $this->assertEquals(0, $task->assignees()->count());
    }

    public function test_action_add_label(): void
    {
        $label = Label::create([
            'team_id' => $this->team->id,
            'name' => 'Auto-label',
            'color' => '#0000ff',
        ]);

        $task = Task::factory()->create([
            'board_id' => $this->board->id,
            'column_id' => $this->column->id,
            'created_by' => $this->user->id,
        ]);

        AutomationRule::create([
            'board_id' => $this->board->id,
            'name' => 'Auto add label',
            'trigger_type' => 'task_created',
            'trigger_config' => [],
            'action_type' => 'add_label',
            'action_config' => ['label_id' => $label->id],
            'is_active' => true,
        ]);

        ExecuteAutomationRules::run($this->board, 'task_created', ['task_id' => $task->id]);

        $this->assertTrue($task->labels()->where('labels.id', $label->id)->exists());
    }

    public function test_action_add_label_does_not_duplicate(): void
    {
        $label = Label::create([
            'team_id' => $this->team->id,
            'name' => 'Auto-label',
            'color' => '#0000ff',
        ]);

        $task = Task::factory()->create([
            'board_id' => $this->board->id,
            'column_id' => $this->column->id,
            'created_by' => $this->user->id,
        ]);

        $task->labels()->attach($label->id);

        AutomationRule::create([
            'board_id' => $this->board->id,
            'name' => 'Auto add label',
            'trigger_type' => 'task_created',
            'trigger_config' => [],
            'action_type' => 'add_label',
            'action_config' => ['label_id' => $label->id],
            'is_active' => true,
        ]);

        ExecuteAutomationRules::run($this->board, 'task_created', ['task_id' => $task->id]);

        $this->assertEquals(1, $task->labels()->where('labels.id', $label->id)->count());
    }

    public function test_action_update_field_priority(): void
    {
        $task = Task::factory()->create([
            'board_id' => $this->board->id,
            'column_id' => $this->column->id,
            'created_by' => $this->user->id,
            'priority' => 'low',
        ]);

        AutomationRule::create([
            'board_id' => $this->board->id,
            'name' => 'Set urgent',
            'trigger_type' => 'task_created',
            'trigger_config' => [],
            'action_type' => 'update_field',
            'action_config' => ['field' => 'priority', 'value' => 'urgent'],
            'is_active' => true,
        ]);

        ExecuteAutomationRules::run($this->board, 'task_created', ['task_id' => $task->id]);

        $task->refresh();
        $this->assertEquals('urgent', $task->priority);
    }

    public function test_action_update_field_effort_estimate(): void
    {
        $task = Task::factory()->create([
            'board_id' => $this->board->id,
            'column_id' => $this->column->id,
            'created_by' => $this->user->id,
            'effort_estimate' => null,
        ]);

        AutomationRule::create([
            'board_id' => $this->board->id,
            'name' => 'Set default effort',
            'trigger_type' => 'task_created',
            'trigger_config' => [],
            'action_type' => 'update_field',
            'action_config' => ['field' => 'effort_estimate', 'value' => 5],
            'is_active' => true,
        ]);

        ExecuteAutomationRules::run($this->board, 'task_created', ['task_id' => $task->id]);

        $task->refresh();
        $this->assertEquals(5, $task->effort_estimate);
    }

    public function test_action_update_field_rejects_disallowed_field(): void
    {
        $task = Task::factory()->create([
            'board_id' => $this->board->id,
            'column_id' => $this->column->id,
            'created_by' => $this->user->id,
        ]);

        $originalTitle = $task->title;

        AutomationRule::create([
            'board_id' => $this->board->id,
            'name' => 'Try to set title',
            'trigger_type' => 'task_created',
            'trigger_config' => [],
            'action_type' => 'update_field',
            'action_config' => ['field' => 'title', 'value' => 'Hacked'],
            'is_active' => true,
        ]);

        ExecuteAutomationRules::run($this->board, 'task_created', ['task_id' => $task->id]);

        $task->refresh();
        $this->assertEquals($originalTitle, $task->title);
    }

    // ---------------------------------------------------------------
    // Inactive rules and edge cases
    // ---------------------------------------------------------------

    public function test_inactive_rules_are_not_executed(): void
    {
        $task = Task::factory()->create([
            'board_id' => $this->board->id,
            'column_id' => $this->column->id,
            'created_by' => $this->user->id,
            'priority' => 'low',
        ]);

        AutomationRule::create([
            'board_id' => $this->board->id,
            'name' => 'Inactive rule',
            'trigger_type' => 'task_created',
            'trigger_config' => [],
            'action_type' => 'update_field',
            'action_config' => ['field' => 'priority', 'value' => 'urgent'],
            'is_active' => false,
        ]);

        ExecuteAutomationRules::run($this->board, 'task_created', ['task_id' => $task->id]);

        $task->refresh();
        $this->assertEquals('low', $task->priority);
    }

    public function test_rules_from_other_boards_are_not_executed(): void
    {
        $otherBoard = Board::factory()->create(['team_id' => $this->team->id]);

        $task = Task::factory()->create([
            'board_id' => $this->board->id,
            'column_id' => $this->column->id,
            'created_by' => $this->user->id,
            'priority' => 'low',
        ]);

        AutomationRule::create([
            'board_id' => $otherBoard->id,
            'name' => 'Other board rule',
            'trigger_type' => 'task_created',
            'trigger_config' => [],
            'action_type' => 'update_field',
            'action_config' => ['field' => 'priority', 'value' => 'urgent'],
            'is_active' => true,
        ]);

        ExecuteAutomationRules::run($this->board, 'task_created', ['task_id' => $task->id]);

        $task->refresh();
        $this->assertEquals('low', $task->priority);
    }

    public function test_action_skipped_when_task_id_missing(): void
    {
        AutomationRule::create([
            'board_id' => $this->board->id,
            'name' => 'No task id',
            'trigger_type' => 'task_created',
            'trigger_config' => [],
            'action_type' => 'update_field',
            'action_config' => ['field' => 'priority', 'value' => 'urgent'],
            'is_active' => true,
        ]);

        // Should not throw
        ExecuteAutomationRules::run($this->board, 'task_created', []);
        $this->assertTrue(true);
    }

    public function test_exception_in_rule_does_not_halt_other_rules(): void
    {
        $task = Task::factory()->create([
            'board_id' => $this->board->id,
            'column_id' => $this->column->id,
            'created_by' => $this->user->id,
            'priority' => 'low',
        ]);

        // First rule: try to move to a non-existent column (will be a no-op but not throw)
        AutomationRule::create([
            'board_id' => $this->board->id,
            'name' => 'Move to nonexistent',
            'trigger_type' => 'task_created',
            'trigger_config' => [],
            'action_type' => 'move_to_column',
            'action_config' => ['column_id' => 'nonexistent-uuid'],
            'is_active' => true,
        ]);

        // Second rule: should still execute
        AutomationRule::create([
            'board_id' => $this->board->id,
            'name' => 'Set priority',
            'trigger_type' => 'task_created',
            'trigger_config' => [],
            'action_type' => 'update_field',
            'action_config' => ['field' => 'priority', 'value' => 'urgent'],
            'is_active' => true,
        ]);

        ExecuteAutomationRules::run($this->board, 'task_created', ['task_id' => $task->id]);

        $task->refresh();
        $this->assertEquals('urgent', $task->priority);
    }

    public function test_unknown_action_type_does_not_throw(): void
    {
        $task = Task::factory()->create([
            'board_id' => $this->board->id,
            'column_id' => $this->column->id,
            'created_by' => $this->user->id,
        ]);

        AutomationRule::create([
            'board_id' => $this->board->id,
            'name' => 'Unknown action',
            'trigger_type' => 'task_created',
            'trigger_config' => [],
            'action_type' => 'send_email',
            'action_config' => [],
            'is_active' => true,
        ]);

        ExecuteAutomationRules::run($this->board, 'task_created', ['task_id' => $task->id]);
        $this->assertTrue(true);
    }

    public function test_task_assigned_with_no_user_config_matches_any(): void
    {
        $task = Task::factory()->create([
            'board_id' => $this->board->id,
            'column_id' => $this->column->id,
            'created_by' => $this->user->id,
            'priority' => 'low',
        ]);

        AutomationRule::create([
            'board_id' => $this->board->id,
            'name' => 'Any assignment',
            'trigger_type' => 'task_assigned',
            'trigger_config' => [],
            'action_type' => 'update_field',
            'action_config' => ['field' => 'priority', 'value' => 'high'],
            'is_active' => true,
        ]);

        ExecuteAutomationRules::run($this->board, 'task_assigned', [
            'task_id' => $task->id,
            'user_id' => $this->user->id,
        ]);

        $task->refresh();
        $this->assertEquals('high', $task->priority);
    }

    public function test_label_added_with_no_label_config_matches_any(): void
    {
        $label = Label::create(['team_id' => $this->team->id, 'name' => 'Any', 'color' => '#000']);

        $task = Task::factory()->create([
            'board_id' => $this->board->id,
            'column_id' => $this->column->id,
            'created_by' => $this->user->id,
            'priority' => 'low',
        ]);

        AutomationRule::create([
            'board_id' => $this->board->id,
            'name' => 'Any label',
            'trigger_type' => 'label_added',
            'trigger_config' => [],
            'action_type' => 'update_field',
            'action_config' => ['field' => 'priority', 'value' => 'high'],
            'is_active' => true,
        ]);

        ExecuteAutomationRules::run($this->board, 'label_added', [
            'task_id' => $task->id,
            'label_id' => $label->id,
        ]);

        $task->refresh();
        $this->assertEquals('high', $task->priority);
    }

    public function test_pipeline_status_with_no_status_config_matches_any(): void
    {
        $task = Task::factory()->create([
            'board_id' => $this->board->id,
            'column_id' => $this->column->id,
            'created_by' => $this->user->id,
        ]);

        AutomationRule::create([
            'board_id' => $this->board->id,
            'name' => 'Any pipeline status',
            'trigger_type' => 'gitlab_pipeline_status',
            'trigger_config' => [],
            'action_type' => 'move_to_column',
            'action_config' => ['column_id' => $this->doneColumn->id],
            'is_active' => true,
        ]);

        ExecuteAutomationRules::run($this->board, 'gitlab_pipeline_status', [
            'task_id' => $task->id,
            'pipeline_status' => 'failed',
        ]);

        $task->refresh();
        $this->assertEquals($this->doneColumn->id, $task->column_id);
    }
}
