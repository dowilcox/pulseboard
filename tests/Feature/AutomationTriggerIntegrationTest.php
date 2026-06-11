<?php

namespace Tests\Feature;

use App\Actions\Automation\ExecuteAutomationRules;
use App\Actions\Gitlab\HandleMergeRequestWebhook;
use App\Actions\Gitlab\HandlePipelineWebhook;
use App\Models\AutomationRule;
use App\Models\Board;
use App\Models\Column;
use App\Models\GitlabConnection;
use App\Models\GitlabProject;
use App\Models\Task;
use App\Models\TaskGitlabRef;
use App\Models\Team;
use App\Models\TeamMember;
use App\Models\User;
use App\Notifications\TaskAssignedNotification;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AutomationTriggerIntegrationTest extends TestCase
{
    use RefreshDatabase;

    private User $user;

    private Team $team;

    private Board $board;

    private Column $column;

    private Column $doneColumn;

    private GitlabProject $gitlabProject;

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

        $connection = GitlabConnection::create([
            'team_id' => $this->team->id,
            'name' => 'Test Connection',
            'base_url' => 'https://gitlab.example.com',
            'api_token' => 'token',
            'webhook_secret' => 'secret',
            'is_active' => true,
        ]);

        $this->gitlabProject = GitlabProject::create([
            'gitlab_connection_id' => $connection->id,
            'team_id' => $this->team->id,
            'gitlab_project_id' => 42,
            'name' => 'Test Project',
            'path_with_namespace' => 'group/test-project',
            'default_branch' => 'main',
            'web_url' => 'https://gitlab.example.com/group/test-project',
        ]);
    }

    private function makeTask(array $attributes = []): Task
    {
        return Task::factory()->create(array_merge([
            'board_id' => $this->board->id,
            'column_id' => $this->column->id,
            'created_by' => $this->user->id,
        ], $attributes));
    }

    private function makeMergeRequestRef(Task $task, int $iid, string $state = 'opened'): TaskGitlabRef
    {
        return TaskGitlabRef::create([
            'task_id' => $task->id,
            'ref_type' => 'merge_request',
            'gitlab_iid' => $iid,
            'gitlab_ref' => 'feature/test',
            'title' => 'Test MR',
            'state' => $state,
            'url' => 'https://gitlab.example.com/group/test-project/-/merge_requests/'.$iid,
        ]);
    }

    private function mergeRequestPayload(int $iid, string $state): array
    {
        return [
            'object_attributes' => [
                'iid' => $iid,
                'state' => $state,
                'title' => 'Test MR',
                'description' => '',
                'source_branch' => 'feature/test',
                'target_branch' => 'main',
                'url' => 'https://gitlab.example.com/group/test-project/-/merge_requests/'.$iid,
            ],
            'user' => ['name' => 'GitLab User'],
        ];
    }

    // ---------------------------------------------------------------
    // gitlab_mr_merged via merge request webhook
    // ---------------------------------------------------------------

    public function test_mr_merged_webhook_fires_gitlab_mr_merged_automation(): void
    {
        $task = $this->makeTask(['gitlab_project_id' => $this->gitlabProject->id]);
        $this->makeMergeRequestRef($task, 7, 'opened');

        AutomationRule::create([
            'board_id' => $this->board->id,
            'name' => 'Move to Done on MR merged',
            'trigger_type' => 'gitlab_mr_merged',
            'trigger_config' => [],
            'action_type' => 'move_to_column',
            'action_config' => ['column_id' => $this->doneColumn->id],
            'is_active' => true,
        ]);

        HandleMergeRequestWebhook::run($this->gitlabProject, $this->mergeRequestPayload(7, 'merged'));

        $task->refresh();
        $this->assertEquals($this->doneColumn->id, $task->column_id);
    }

    public function test_mr_webhook_does_not_refire_when_state_was_already_merged(): void
    {
        $task = $this->makeTask([
            'gitlab_project_id' => $this->gitlabProject->id,
            'priority' => 'low',
        ]);
        $this->makeMergeRequestRef($task, 8, 'merged');

        AutomationRule::create([
            'board_id' => $this->board->id,
            'name' => 'Set urgent on MR merged',
            'trigger_type' => 'gitlab_mr_merged',
            'trigger_config' => [],
            'action_type' => 'update_field',
            'action_config' => ['field' => 'priority', 'value' => 'urgent'],
            'is_active' => true,
        ]);

        HandleMergeRequestWebhook::run($this->gitlabProject, $this->mergeRequestPayload(8, 'merged'));

        $task->refresh();
        $this->assertEquals('low', $task->priority);
    }

    public function test_mr_opened_webhook_does_not_fire_gitlab_mr_merged_automation(): void
    {
        $task = $this->makeTask(['gitlab_project_id' => $this->gitlabProject->id]);
        $this->makeMergeRequestRef($task, 9, 'opened');

        AutomationRule::create([
            'board_id' => $this->board->id,
            'name' => 'Move to Done on MR merged',
            'trigger_type' => 'gitlab_mr_merged',
            'trigger_config' => [],
            'action_type' => 'move_to_column',
            'action_config' => ['column_id' => $this->doneColumn->id],
            'is_active' => true,
        ]);

        HandleMergeRequestWebhook::run($this->gitlabProject, $this->mergeRequestPayload(9, 'opened'));

        $task->refresh();
        $this->assertEquals($this->column->id, $task->column_id);
    }

    // ---------------------------------------------------------------
    // gitlab_pipeline_status via pipeline webhook
    // ---------------------------------------------------------------

    public function test_pipeline_webhook_fires_gitlab_pipeline_status_automation(): void
    {
        $task = $this->makeTask(['gitlab_project_id' => $this->gitlabProject->id]);
        $this->makeMergeRequestRef($task, 10, 'opened');

        AutomationRule::create([
            'board_id' => $this->board->id,
            'name' => 'Move to Done on pipeline success',
            'trigger_type' => 'gitlab_pipeline_status',
            'trigger_config' => ['status' => 'success'],
            'action_type' => 'move_to_column',
            'action_config' => ['column_id' => $this->doneColumn->id],
            'is_active' => true,
        ]);

        HandlePipelineWebhook::run($this->gitlabProject, [
            'object_attributes' => [
                'ref' => 'feature/test',
                'status' => 'success',
            ],
        ]);

        $task->refresh();
        $this->assertEquals($this->doneColumn->id, $task->column_id);
    }

    public function test_pipeline_webhook_does_not_refire_when_status_unchanged(): void
    {
        $task = $this->makeTask([
            'gitlab_project_id' => $this->gitlabProject->id,
            'priority' => 'low',
        ]);
        $ref = $this->makeMergeRequestRef($task, 11, 'opened');
        $ref->update(['pipeline_status' => 'success']);

        AutomationRule::create([
            'board_id' => $this->board->id,
            'name' => 'Set urgent on any pipeline status',
            'trigger_type' => 'gitlab_pipeline_status',
            'trigger_config' => [],
            'action_type' => 'update_field',
            'action_config' => ['field' => 'priority', 'value' => 'urgent'],
            'is_active' => true,
        ]);

        HandlePipelineWebhook::run($this->gitlabProject, [
            'object_attributes' => [
                'ref' => 'feature/test',
                'status' => 'success',
            ],
        ]);

        $task->refresh();
        $this->assertEquals('low', $task->priority);
    }

    // ---------------------------------------------------------------
    // due_date_reached via scheduled command
    // ---------------------------------------------------------------

    public function test_due_date_command_fires_due_date_reached_exactly_once(): void
    {
        $task = $this->makeTask([
            'due_date' => now()->toDateString(),
            'priority' => 'low',
            'completed_at' => null,
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

        $this->artisan('automations:run-due-date')->assertSuccessful();

        $task->refresh();
        $this->assertEquals('urgent', $task->priority);

        // Reset the priority and run again the same day: the trigger must
        // not fire a second time.
        $task->update(['priority' => 'low']);

        $this->artisan('automations:run-due-date')->assertSuccessful();

        $task->refresh();
        $this->assertEquals('low', $task->priority);
    }

    public function test_due_date_command_ignores_tasks_not_yet_due(): void
    {
        $task = $this->makeTask([
            'due_date' => now()->addDays(3)->toDateString(),
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

        $this->artisan('automations:run-due-date')->assertSuccessful();

        $task->refresh();
        $this->assertEquals('low', $task->priority);
    }

    public function test_due_date_command_ignores_completed_and_done_column_tasks(): void
    {
        $completedTask = $this->makeTask([
            'due_date' => now()->toDateString(),
            'priority' => 'low',
            'completed_at' => now(),
        ]);

        $doneTask = $this->makeTask([
            'due_date' => now()->toDateString(),
            'priority' => 'low',
            'column_id' => $this->doneColumn->id,
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

        $this->artisan('automations:run-due-date')->assertSuccessful();

        $this->assertEquals('low', $completedTask->fresh()->priority);
        $this->assertEquals('low', $doneTask->fresh()->priority);
    }

    // ---------------------------------------------------------------
    // Automated actions go through the activity/notification pipeline
    // ---------------------------------------------------------------

    public function test_automated_assign_logs_activity_and_notifies_assignee(): void
    {
        $assignee = User::factory()->create();
        TeamMember::create([
            'team_id' => $this->team->id,
            'user_id' => $assignee->id,
            'role' => 'member',
        ]);

        $task = $this->makeTask();

        AutomationRule::create([
            'board_id' => $this->board->id,
            'name' => 'Auto assign on create',
            'trigger_type' => 'task_created',
            'trigger_config' => [],
            'action_type' => 'assign_user',
            'action_config' => ['user_id' => $assignee->id],
            'is_active' => true,
        ]);

        ExecuteAutomationRules::run($this->board, 'task_created', ['task_id' => $task->id]);

        $this->assertTrue($task->assignees()->where('users.id', $assignee->id)->exists());

        $this->assertDatabaseHas('activities', [
            'task_id' => $task->id,
            'action' => 'assigned',
        ]);

        $this->assertDatabaseHas('notifications', [
            'notifiable_id' => $assignee->id,
            'notifiable_type' => User::class,
            'type' => TaskAssignedNotification::class,
        ]);
    }

    public function test_automated_assign_preserves_existing_assignees(): void
    {
        $assignee = User::factory()->create();
        TeamMember::create([
            'team_id' => $this->team->id,
            'user_id' => $assignee->id,
            'role' => 'member',
        ]);

        $task = $this->makeTask();
        $task->assignees()->attach($this->user->id, [
            'assigned_at' => now(),
            'assigned_by' => $this->user->id,
        ]);

        AutomationRule::create([
            'board_id' => $this->board->id,
            'name' => 'Auto assign on create',
            'trigger_type' => 'task_created',
            'trigger_config' => [],
            'action_type' => 'assign_user',
            'action_config' => ['user_id' => $assignee->id],
            'is_active' => true,
        ]);

        ExecuteAutomationRules::run($this->board, 'task_created', ['task_id' => $task->id]);

        $this->assertTrue($task->assignees()->where('users.id', $this->user->id)->exists());
        $this->assertTrue($task->assignees()->where('users.id', $assignee->id)->exists());
    }

    public function test_automated_update_field_chains_priority_changed_rules(): void
    {
        $task = $this->makeTask(['priority' => 'low']);

        AutomationRule::create([
            'board_id' => $this->board->id,
            'name' => 'Set urgent on create',
            'trigger_type' => 'task_created',
            'trigger_config' => [],
            'action_type' => 'update_field',
            'action_config' => ['field' => 'priority', 'value' => 'urgent'],
            'is_active' => true,
        ]);

        AutomationRule::create([
            'board_id' => $this->board->id,
            'name' => 'Move urgent tasks to Done',
            'trigger_type' => 'priority_changed',
            'trigger_config' => ['priority' => 'urgent'],
            'action_type' => 'move_to_column',
            'action_config' => ['column_id' => $this->doneColumn->id],
            'is_active' => true,
        ]);

        ExecuteAutomationRules::run($this->board, 'task_created', ['task_id' => $task->id]);

        $task->refresh();
        $this->assertEquals('urgent', $task->priority);
        $this->assertEquals($this->doneColumn->id, $task->column_id);

        $this->assertDatabaseHas('activities', [
            'task_id' => $task->id,
            'action' => 'field_changed',
        ]);
    }
}
