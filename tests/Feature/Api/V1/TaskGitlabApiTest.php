<?php

namespace Tests\Feature\Api\V1;

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
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class TaskGitlabApiTest extends TestCase
{
    use RefreshDatabase;

    private User $user;

    private Team $team;

    private Board $board;

    private Column $column;

    private Task $task;

    private GitlabConnection $connection;

    private GitlabProject $project;

    private string $token;

    protected function setUp(): void
    {
        parent::setUp();

        $this->user = User::factory()->create();
        $this->team = Team::factory()->create();
        TeamMember::create(['team_id' => $this->team->id, 'user_id' => $this->user->id, 'role' => 'owner']);
        $this->board = Board::factory()->create(['team_id' => $this->team->id]);
        $this->column = Column::factory()->create(['board_id' => $this->board->id]);
        $this->task = Task::factory()->create([
            'board_id' => $this->board->id,
            'column_id' => $this->column->id,
            'created_by' => $this->user->id,
            'title' => 'Fix login bug',
            'task_number' => 42,
        ]);
        $this->connection = $this->createConnection($this->team);
        $this->project = $this->createProject($this->team, $this->connection);
        $this->token = $this->user->createToken('test', ['read', 'write'])->plainTextToken;
    }

    private function api(): static
    {
        return $this->withHeader('Authorization', "Bearer {$this->token}");
    }

    private function baseUrl(): string
    {
        return "/api/v1/teams/{$this->team->id}/boards/{$this->board->id}/tasks/{$this->task->id}/gitlab";
    }

    private function createConnection(Team $team): GitlabConnection
    {
        return GitlabConnection::create([
            'team_id' => $team->id,
            'name' => 'Test Connection',
            'base_url' => 'https://gitlab.example.com',
            'api_token' => 'token',
            'webhook_secret' => 'secret',
            'is_active' => true,
        ]);
    }

    private function createProject(Team $team, GitlabConnection $connection, int $gitlabProjectId = 123): GitlabProject
    {
        return GitlabProject::create([
            'gitlab_connection_id' => $connection->id,
            'team_id' => $team->id,
            'gitlab_project_id' => $gitlabProjectId,
            'name' => 'Demo Project',
            'path_with_namespace' => 'group/demo',
            'default_branch' => 'main',
            'web_url' => 'https://gitlab.example.com/group/demo',
        ]);
    }

    private function createBranchRef(Task $task, string $branch = 'pb-42-fix-login-bug'): TaskGitlabRef
    {
        return TaskGitlabRef::create([
            'task_id' => $task->id,
            'ref_type' => 'branch',
            'gitlab_ref' => $branch,
            'title' => $branch,
            'url' => "https://gitlab.example.com/group/demo/-/tree/{$branch}",
        ]);
    }

    public function test_index_lists_gitlab_refs(): void
    {
        $this->createBranchRef($this->task);
        TaskGitlabRef::create([
            'task_id' => $this->task->id,
            'ref_type' => 'merge_request',
            'gitlab_iid' => 7,
            'gitlab_ref' => 'pb-42-fix-login-bug',
            'title' => '#42: Fix login bug',
            'state' => 'opened',
            'url' => 'https://gitlab.example.com/group/demo/-/merge_requests/7',
        ]);

        $response = $this->api()->getJson($this->baseUrl());

        $response->assertOk();
        $response->assertJsonCount(2, 'data');
        $response->assertJsonStructure(['data' => [['id', 'task_id', 'ref_type', 'gitlab_ref', 'title', 'url']]]);
    }

    public function test_set_project_links_gitlab_project_to_task(): void
    {
        $response = $this->api()->putJson("{$this->baseUrl()}/project", [
            'gitlab_project_id' => $this->project->id,
        ]);

        $response->assertOk();
        $response->assertJsonPath('data.gitlab_project_id', $this->project->id);
        $response->assertJsonPath('data.gitlab_project.id', $this->project->id);
        $this->assertEquals($this->project->id, $this->task->fresh()->gitlab_project_id);
    }

    public function test_set_project_with_null_unlinks_project(): void
    {
        $this->task->update(['gitlab_project_id' => $this->project->id]);

        $response = $this->api()->putJson("{$this->baseUrl()}/project", [
            'gitlab_project_id' => null,
        ]);

        $response->assertOk();
        $response->assertJsonPath('data.gitlab_project_id', null);
        $this->assertNull($this->task->fresh()->gitlab_project_id);
    }

    public function test_set_project_rejects_project_from_another_team(): void
    {
        $foreignTeam = Team::factory()->create();
        $foreignConnection = $this->createConnection($foreignTeam);
        $foreignProject = $this->createProject($foreignTeam, $foreignConnection, 999);

        $response = $this->api()->putJson("{$this->baseUrl()}/project", [
            'gitlab_project_id' => $foreignProject->id,
        ]);

        $response->assertNotFound();
        $this->assertNull($this->task->fresh()->gitlab_project_id);
    }

    public function test_create_branch(): void
    {
        $this->task->update(['gitlab_project_id' => $this->project->id]);

        Http::fake([
            'gitlab.example.com/api/v4/projects/123/repository/branches' => Http::response([
                'name' => 'pb-42-fix-login-bug',
            ], 201),
        ]);

        $response = $this->api()->postJson("{$this->baseUrl()}/branch");

        $response->assertCreated();
        $response->assertJsonPath('data.ref_type', 'branch');
        $response->assertJsonPath('data.gitlab_ref', 'pb-42-fix-login-bug');
        $response->assertJsonPath('data.url', 'https://gitlab.example.com/group/demo/-/tree/pb-42-fix-login-bug');
        $this->assertDatabaseHas('task_gitlab_refs', [
            'task_id' => $this->task->id,
            'ref_type' => 'branch',
            'gitlab_ref' => 'pb-42-fix-login-bug',
        ]);
    }

    public function test_create_branch_requires_linked_project(): void
    {
        Http::fake();

        $response = $this->api()->postJson("{$this->baseUrl()}/branch");

        $response->assertStatus(422);
        $response->assertJsonPath('error', 'No GitLab project set for this task');
        Http::assertNothingSent();
    }

    public function test_create_branch_conflicts_when_branch_already_exists(): void
    {
        $this->task->update(['gitlab_project_id' => $this->project->id]);
        $this->createBranchRef($this->task);

        Http::fake();

        $response = $this->api()->postJson("{$this->baseUrl()}/branch");

        $response->assertStatus(409);
        $response->assertJsonStructure(['error']);
        Http::assertNothingSent();
    }

    public function test_create_branch_returns_422_when_gitlab_api_fails(): void
    {
        $this->task->update(['gitlab_project_id' => $this->project->id]);

        Http::fake([
            'gitlab.example.com/api/v4/projects/123/repository/branches' => Http::response([
                'message' => 'Branch already exists',
            ], 400),
        ]);

        $response = $this->api()->postJson("{$this->baseUrl()}/branch");

        $response->assertStatus(422);
        $this->assertStringContainsString('Branch already exists', $response->json('error'));
        $this->assertDatabaseMissing('task_gitlab_refs', ['task_id' => $this->task->id]);
    }

    public function test_create_merge_request(): void
    {
        $this->task->update(['gitlab_project_id' => $this->project->id]);
        $this->createBranchRef($this->task);

        Http::fake([
            'gitlab.example.com/api/v4/projects/123/merge_requests' => Http::response([
                'iid' => 7,
                'title' => '#42: Fix login bug',
                'state' => 'opened',
                'web_url' => 'https://gitlab.example.com/group/demo/-/merge_requests/7',
                'author' => ['name' => 'Alice'],
            ], 201),
        ]);

        $response = $this->api()->postJson("{$this->baseUrl()}/merge-request");

        $response->assertCreated();
        $response->assertJsonPath('data.ref_type', 'merge_request');
        $response->assertJsonPath('data.gitlab_iid', 7);
        $response->assertJsonPath('data.state', 'opened');
        $response->assertJsonPath('data.gitlab_ref', 'pb-42-fix-login-bug');
        $response->assertJsonPath('data.author', 'Alice');
        $this->assertDatabaseHas('task_gitlab_refs', [
            'task_id' => $this->task->id,
            'ref_type' => 'merge_request',
            'gitlab_iid' => 7,
        ]);
    }

    public function test_create_merge_request_with_explicit_source_branch(): void
    {
        $this->task->update(['gitlab_project_id' => $this->project->id]);

        Http::fake([
            'gitlab.example.com/api/v4/projects/123/merge_requests' => Http::response([
                'iid' => 8,
                'title' => '#42: Fix login bug',
                'state' => 'opened',
                'web_url' => 'https://gitlab.example.com/group/demo/-/merge_requests/8',
                'author' => ['name' => 'Alice'],
            ], 201),
        ]);

        $response = $this->api()->postJson("{$this->baseUrl()}/merge-request", [
            'source_branch' => 'custom-branch',
        ]);

        $response->assertCreated();
        $response->assertJsonPath('data.gitlab_ref', 'custom-branch');
        Http::assertSent(function ($request) {
            return str_contains($request->url(), '/merge_requests')
                && $request['source_branch'] === 'custom-branch'
                && $request['target_branch'] === 'main';
        });
    }

    public function test_create_merge_request_requires_linked_project(): void
    {
        Http::fake();

        $response = $this->api()->postJson("{$this->baseUrl()}/merge-request");

        $response->assertStatus(422);
        $response->assertJsonPath('error', 'No GitLab project set for this task');
        Http::assertNothingSent();
    }

    public function test_create_merge_request_conflicts_when_open_mr_exists(): void
    {
        $this->task->update(['gitlab_project_id' => $this->project->id]);
        TaskGitlabRef::create([
            'task_id' => $this->task->id,
            'ref_type' => 'merge_request',
            'gitlab_iid' => 7,
            'gitlab_ref' => 'pb-42-fix-login-bug',
            'title' => '#42: Fix login bug',
            'state' => 'opened',
            'url' => 'https://gitlab.example.com/group/demo/-/merge_requests/7',
        ]);

        Http::fake();

        $response = $this->api()->postJson("{$this->baseUrl()}/merge-request");

        $response->assertStatus(409);
        $response->assertJsonStructure(['error']);
        Http::assertNothingSent();
    }

    public function test_create_merge_request_returns_422_when_gitlab_api_fails(): void
    {
        $this->task->update(['gitlab_project_id' => $this->project->id]);
        $this->createBranchRef($this->task);

        Http::fake([
            'gitlab.example.com/api/v4/projects/123/merge_requests' => Http::response([
                'message' => 'Something went wrong',
            ], 500),
        ]);

        $response = $this->api()->postJson("{$this->baseUrl()}/merge-request");

        $response->assertStatus(422);
        $this->assertStringContainsString('Something went wrong', $response->json('error'));
    }

    public function test_destroy_ref(): void
    {
        $ref = $this->createBranchRef($this->task);

        $response = $this->api()->deleteJson("{$this->baseUrl()}/{$ref->id}");

        $response->assertNoContent();
        $this->assertDatabaseMissing('task_gitlab_refs', ['id' => $ref->id]);
    }

    public function test_destroy_ref_scoped_to_task(): void
    {
        $otherTask = Task::factory()->create([
            'board_id' => $this->board->id,
            'column_id' => $this->column->id,
            'created_by' => $this->user->id,
        ]);
        $foreignRef = $this->createBranchRef($otherTask);

        $response = $this->api()->deleteJson("{$this->baseUrl()}/{$foreignRef->id}");

        $response->assertNotFound();
        $this->assertDatabaseHas('task_gitlab_refs', ['id' => $foreignRef->id]);
    }

    public function test_write_endpoints_require_write_ability(): void
    {
        $readToken = $this->user->createToken('read-only', ['read'])->plainTextToken;
        $api = fn () => $this->withHeader('Authorization', "Bearer {$readToken}");

        $api()->putJson("{$this->baseUrl()}/project", ['gitlab_project_id' => $this->project->id])
            ->assertForbidden();
        $api()->postJson("{$this->baseUrl()}/branch")->assertForbidden();
        $api()->postJson("{$this->baseUrl()}/merge-request")->assertForbidden();

        $ref = $this->createBranchRef($this->task);
        $api()->deleteJson("{$this->baseUrl()}/{$ref->id}")->assertForbidden();

        // Reads still work with a read-only token
        $api()->getJson($this->baseUrl())->assertOk();
    }
}
