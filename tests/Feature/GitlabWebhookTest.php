<?php

namespace Tests\Feature;

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
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

class GitlabWebhookTest extends TestCase
{
    use RefreshDatabase;

    private User $user;

    private Team $team;

    private Board $board;

    private Board $otherBoard;

    private GitlabConnection $connection;

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
        $this->otherBoard = Board::factory()->create(['team_id' => $this->team->id]);

        $this->connection = GitlabConnection::create([
            'team_id' => $this->team->id,
            'name' => 'Test Connection',
            'base_url' => 'https://gitlab.example.com',
            'api_token' => 'token',
            'webhook_secret' => 'secret',
            'is_active' => true,
        ]);

        $this->gitlabProject = $this->makeGitlabProject(42);
    }

    private function makeGitlabProject(int $gitlabProjectId): GitlabProject
    {
        return GitlabProject::create([
            'gitlab_connection_id' => $this->connection->id,
            'team_id' => $this->team->id,
            'gitlab_project_id' => $gitlabProjectId,
            'name' => "Project {$gitlabProjectId}",
            'path_with_namespace' => "group/project-{$gitlabProjectId}",
            'default_branch' => 'main',
            'web_url' => "https://gitlab.example.com/group/project-{$gitlabProjectId}",
        ]);
    }

    private function makeTask(Board $board, int $taskNumber, array $attributes = []): Task
    {
        return Task::factory()->create(array_merge([
            'board_id' => $board->id,
            'column_id' => Column::factory()->create(['board_id' => $board->id])->id,
            'task_number' => $taskNumber,
            'created_by' => $this->user->id,
        ], $attributes));
    }

    private function sendWebhook(string $event, array $payload, ?string $token = 'secret', ?GitlabConnection $connection = null): TestResponse
    {
        $headers = ['X-Gitlab-Event' => $event];

        if ($token !== null) {
            $headers['X-Gitlab-Token'] = $token;
        }

        return $this->postJson(
            route('webhooks.gitlab', $connection ?? $this->connection),
            $payload,
            $headers,
        );
    }

    private function mergeRequestPayload(int $iid, string $state, string $title, string $sourceBranch = 'feature/test', int $projectId = 42): array
    {
        return [
            'object_kind' => 'merge_request',
            'project' => ['id' => $projectId],
            'user' => ['name' => 'GitLab User'],
            'object_attributes' => [
                'iid' => $iid,
                'state' => $state,
                'title' => $title,
                'description' => '',
                'source_branch' => $sourceBranch,
                'target_branch' => 'main',
                'url' => "https://gitlab.example.com/group/project-{$projectId}/-/merge_requests/{$iid}",
            ],
        ];
    }

    private function pushPayload(string $branch, string $after = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2'): array
    {
        return [
            'object_kind' => 'push',
            'project' => ['id' => 42],
            'ref' => "refs/heads/{$branch}",
            'after' => $after,
        ];
    }

    // ---------------------------------------------------------------
    // Request verification
    // ---------------------------------------------------------------

    public function test_rejects_request_without_token(): void
    {
        $this->makeTask($this->board, 12);

        $this->sendWebhook('Merge Request Hook', $this->mergeRequestPayload(1, 'opened', '#12 Fix'), token: null)
            ->assertForbidden();

        $this->assertDatabaseCount('task_gitlab_refs', 0);
    }

    public function test_rejects_request_with_wrong_token(): void
    {
        $this->makeTask($this->board, 12);

        $this->sendWebhook('Merge Request Hook', $this->mergeRequestPayload(1, 'opened', '#12 Fix'), token: 'wrong')
            ->assertForbidden();

        $this->assertDatabaseCount('task_gitlab_refs', 0);
    }

    public function test_returns_not_found_for_unknown_connection(): void
    {
        $this->postJson(
            route('webhooks.gitlab', (string) Str::uuid()),
            $this->mergeRequestPayload(1, 'opened', '#12 Fix'),
            ['X-Gitlab-Event' => 'Merge Request Hook', 'X-Gitlab-Token' => 'secret'],
        )->assertNotFound();
    }

    public function test_rejects_payload_without_project_id(): void
    {
        $this->sendWebhook('Merge Request Hook', ['object_kind' => 'merge_request'])
            ->assertStatus(400);
    }

    public function test_ignores_unlinked_project(): void
    {
        $this->makeTask($this->board, 12);

        $this->sendWebhook('Merge Request Hook', $this->mergeRequestPayload(1, 'opened', '#12 Fix', projectId: 999))
            ->assertOk()
            ->assertJson(['message' => 'Project not linked']);

        $this->assertDatabaseCount('task_gitlab_refs', 0);
    }

    public function test_ignores_unhandled_event(): void
    {
        $this->sendWebhook('Issue Hook', ['object_kind' => 'issue', 'project' => ['id' => 42]])
            ->assertOk()
            ->assertJson(['message' => 'OK']);
    }

    // ---------------------------------------------------------------
    // Merge request auto-linking
    // ---------------------------------------------------------------

    public function test_mr_links_the_only_task_with_that_number(): void
    {
        $task = $this->makeTask($this->board, 12);

        $this->sendWebhook('Merge Request Hook', $this->mergeRequestPayload(5, 'opened', '#12 Fix login'))
            ->assertOk();

        $this->assertDatabaseHas('task_gitlab_refs', [
            'task_id' => $task->id,
            'ref_type' => 'merge_request',
            'gitlab_iid' => 5,
            'state' => 'opened',
        ]);
        $this->assertEquals($this->gitlabProject->id, $task->fresh()->gitlab_project_id);
    }

    public function test_mr_prefers_task_already_linked_to_the_project_when_number_exists_on_several_boards(): void
    {
        $unlinked = $this->makeTask($this->board, 12);
        $linked = $this->makeTask($this->otherBoard, 12, ['gitlab_project_id' => $this->gitlabProject->id]);

        $this->sendWebhook('Merge Request Hook', $this->mergeRequestPayload(5, 'opened', '#12 Fix login'))
            ->assertOk();

        $this->assertDatabaseHas('task_gitlab_refs', ['task_id' => $linked->id, 'gitlab_iid' => 5]);
        $this->assertDatabaseMissing('task_gitlab_refs', ['task_id' => $unlinked->id]);
        $this->assertNull($unlinked->fresh()->gitlab_project_id);
    }

    public function test_mr_skips_ambiguous_number_on_several_unlinked_boards(): void
    {
        $first = $this->makeTask($this->board, 12);
        $second = $this->makeTask($this->otherBoard, 12);

        $this->sendWebhook('Merge Request Hook', $this->mergeRequestPayload(5, 'opened', '#12 Fix login'))
            ->assertOk();

        $this->assertDatabaseCount('task_gitlab_refs', 0);
        $this->assertNull($first->fresh()->gitlab_project_id);
        $this->assertNull($second->fresh()->gitlab_project_id);
    }

    public function test_mr_never_links_task_belonging_to_another_gitlab_project(): void
    {
        $otherProject = $this->makeGitlabProject(77);
        $foreign = $this->makeTask($this->board, 12, ['gitlab_project_id' => $otherProject->id]);
        $unlinked = $this->makeTask($this->otherBoard, 12);

        $this->sendWebhook('Merge Request Hook', $this->mergeRequestPayload(5, 'opened', '#12 Fix login'))
            ->assertOk();

        $this->assertDatabaseMissing('task_gitlab_refs', ['task_id' => $foreign->id]);
        $this->assertDatabaseHas('task_gitlab_refs', ['task_id' => $unlinked->id, 'gitlab_iid' => 5]);
    }

    public function test_mr_never_links_task_on_an_archived_board(): void
    {
        $this->otherBoard->update(['is_archived' => true]);
        $archived = $this->makeTask($this->otherBoard, 12);

        $this->sendWebhook('Merge Request Hook', $this->mergeRequestPayload(5, 'opened', '#12 Fix login'))
            ->assertOk();

        $this->assertDatabaseCount('task_gitlab_refs', 0);
        $this->assertNull($archived->fresh()->gitlab_project_id);
    }

    public function test_mr_ignores_archived_board_when_resolving_a_number_shared_with_an_active_board(): void
    {
        // Without the archived board this number is unambiguous.
        $active = $this->makeTask($this->board, 12);
        $this->otherBoard->update(['is_archived' => true]);
        $archived = $this->makeTask($this->otherBoard, 12);

        $this->sendWebhook('Merge Request Hook', $this->mergeRequestPayload(5, 'opened', '#12 Fix login'))
            ->assertOk();

        $this->assertDatabaseHas('task_gitlab_refs', ['task_id' => $active->id, 'gitlab_iid' => 5]);
        $this->assertDatabaseMissing('task_gitlab_refs', ['task_id' => $archived->id]);
    }

    public function test_push_never_links_branch_to_task_on_an_archived_board(): void
    {
        $this->board->update(['is_archived' => true]);
        $archived = $this->makeTask($this->board, 12);

        $this->sendWebhook('Push Hook', $this->pushPayload('pb-12-fix-login'))
            ->assertOk();

        $this->assertDatabaseMissing('task_gitlab_refs', ['task_id' => $archived->id]);
    }

    public function test_mr_links_task_from_app_generated_branch_name(): void
    {
        $task = $this->makeTask($this->board, 12);

        $this->sendWebhook('Merge Request Hook', $this->mergeRequestPayload(5, 'opened', 'Fix login', 'pb-12-fix-login'))
            ->assertOk();

        $this->assertDatabaseHas('task_gitlab_refs', [
            'task_id' => $task->id,
            'ref_type' => 'merge_request',
            'gitlab_iid' => 5,
            'gitlab_ref' => 'pb-12-fix-login',
        ]);
    }

    public function test_mr_update_refreshes_existing_ref_without_duplicating_it(): void
    {
        $this->makeTask($this->board, 12);
        $task = $this->makeTask($this->otherBoard, 12, ['gitlab_project_id' => $this->gitlabProject->id]);
        TaskGitlabRef::create([
            'task_id' => $task->id,
            'ref_type' => 'merge_request',
            'gitlab_iid' => 5,
            'gitlab_ref' => 'pb-12-fix-login',
            'title' => '#12: Fix login',
            'state' => 'opened',
            'url' => 'https://gitlab.example.com/group/project-42/-/merge_requests/5',
        ]);

        $this->sendWebhook('Merge Request Hook', $this->mergeRequestPayload(5, 'closed', '#12: Fix login (v2)', 'pb-12-fix-login'))
            ->assertOk();

        $this->assertDatabaseCount('task_gitlab_refs', 1);
        $this->assertDatabaseHas('task_gitlab_refs', [
            'task_id' => $task->id,
            'state' => 'closed',
            'title' => '#12: Fix login (v2)',
        ]);
    }

    public function test_merged_mr_moves_only_the_linked_task(): void
    {
        $doneColumn = Column::factory()->create(['board_id' => $this->board->id, 'name' => 'Done']);
        $otherDoneColumn = Column::factory()->create(['board_id' => $this->otherBoard->id, 'name' => 'Done']);

        $otherTask = $this->makeTask($this->board, 12);
        $task = $this->makeTask($this->otherBoard, 12, ['gitlab_project_id' => $this->gitlabProject->id]);
        $otherTaskColumnId = $otherTask->column_id;

        foreach ([[$this->board, $doneColumn], [$this->otherBoard, $otherDoneColumn]] as [$board, $column]) {
            AutomationRule::create([
                'board_id' => $board->id,
                'name' => 'Move to Done on MR merged',
                'trigger_type' => 'gitlab_mr_merged',
                'trigger_config' => [],
                'action_type' => 'move_to_column',
                'action_config' => ['column_id' => $column->id],
                'is_active' => true,
            ]);
        }

        $this->sendWebhook('Merge Request Hook', $this->mergeRequestPayload(5, 'merged', '#12 Fix login'))
            ->assertOk();

        $this->assertEquals($otherDoneColumn->id, $task->fresh()->column_id);
        $this->assertEquals($otherTaskColumnId, $otherTask->fresh()->column_id);
    }

    // ---------------------------------------------------------------
    // Push and pipeline events
    // ---------------------------------------------------------------

    public function test_push_links_app_generated_branch(): void
    {
        $task = $this->makeTask($this->board, 12);

        $this->sendWebhook('Push Hook', $this->pushPayload('pb-12-fix-login'))
            ->assertOk();

        $this->assertDatabaseHas('task_gitlab_refs', [
            'task_id' => $task->id,
            'ref_type' => 'branch',
            'gitlab_ref' => 'pb-12-fix-login',
            'url' => 'https://gitlab.example.com/group/project-42/-/tree/pb-12-fix-login',
        ]);
    }

    public function test_push_does_not_duplicate_existing_branch_ref(): void
    {
        $task = $this->makeTask($this->board, 12, ['gitlab_project_id' => $this->gitlabProject->id]);
        TaskGitlabRef::create([
            'task_id' => $task->id,
            'ref_type' => 'branch',
            'gitlab_ref' => 'pb-12-fix-login',
            'title' => 'pb-12-fix-login',
            'url' => 'https://gitlab.example.com/group/project-42/-/tree/pb-12-fix-login',
        ]);

        $this->sendWebhook('Push Hook', $this->pushPayload('pb-12-fix-login'))
            ->assertOk();

        $this->assertDatabaseCount('task_gitlab_refs', 1);
    }

    public function test_branch_deletion_push_does_not_link(): void
    {
        $this->makeTask($this->board, 12);

        $this->sendWebhook('Push Hook', $this->pushPayload('pb-12-fix-login', str_repeat('0', 40)))
            ->assertOk();

        $this->assertDatabaseCount('task_gitlab_refs', 0);
    }

    public function test_pipeline_updates_status_of_matching_branch_ref(): void
    {
        $task = $this->makeTask($this->board, 12, ['gitlab_project_id' => $this->gitlabProject->id]);
        $ref = TaskGitlabRef::create([
            'task_id' => $task->id,
            'ref_type' => 'branch',
            'gitlab_ref' => 'pb-12-fix-login',
            'title' => 'pb-12-fix-login',
            'url' => 'https://gitlab.example.com/group/project-42/-/tree/pb-12-fix-login',
        ]);

        $this->sendWebhook('Pipeline Hook', [
            'object_kind' => 'pipeline',
            'project' => ['id' => 42],
            'object_attributes' => ['ref' => 'pb-12-fix-login', 'status' => 'success'],
        ])->assertOk();

        $this->assertEquals('success', $ref->fresh()->pipeline_status);
    }
}
