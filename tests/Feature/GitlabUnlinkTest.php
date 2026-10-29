<?php

namespace Tests\Feature;

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

/**
 * Unlinking a GitLab project (or deleting its connection) removes the task
 * refs that pointed at it: once the project is gone, webhooks and the sync
 * can never update them again.
 */
class GitlabUnlinkTest extends TestCase
{
    use RefreshDatabase;

    private User $owner;

    private Team $team;

    private Board $board;

    private GitlabConnection $connection;

    protected function setUp(): void
    {
        parent::setUp();

        Http::fake();

        $this->owner = User::factory()->create();
        $this->team = Team::factory()->create();
        TeamMember::create(['team_id' => $this->team->id, 'user_id' => $this->owner->id, 'role' => 'owner']);
        $this->board = Board::factory()->create(['team_id' => $this->team->id]);

        $this->connection = GitlabConnection::create([
            'team_id' => $this->team->id,
            'name' => 'GitLab',
            'base_url' => 'https://gitlab.example.com',
            'api_token' => 'token',
            'webhook_secret' => 'secret',
            'is_active' => true,
        ]);
    }

    private function makeProject(int $gitlabId, ?GitlabConnection $connection = null): GitlabProject
    {
        return GitlabProject::create([
            'gitlab_connection_id' => ($connection ?? $this->connection)->id,
            'team_id' => $this->team->id,
            'gitlab_project_id' => $gitlabId,
            'name' => "Project {$gitlabId}",
            'path_with_namespace' => "group/project-{$gitlabId}",
            'default_branch' => 'main',
            'web_url' => "https://gitlab.example.com/group/project-{$gitlabId}",
            'webhook_id' => 1000 + $gitlabId,
        ]);
    }

    /**
     * @return array{0: Task, 1: TaskGitlabRef}
     */
    private function taskWithRef(GitlabProject $project): array
    {
        $task = Task::factory()->create([
            'board_id' => $this->board->id,
            'column_id' => Column::factory()->create(['board_id' => $this->board->id])->id,
            'created_by' => $this->owner->id,
            'gitlab_project_id' => $project->id,
        ]);

        $ref = TaskGitlabRef::create([
            'task_id' => $task->id,
            'ref_type' => 'merge_request',
            'gitlab_iid' => 7,
            'gitlab_ref' => 'pb-1-fix',
            'title' => 'Fix',
            'state' => 'opened',
            'url' => "{$project->web_url}/-/merge_requests/7",
        ]);

        return [$task, $ref];
    }

    public function test_unlinking_a_project_removes_its_task_refs_and_webhook(): void
    {
        $project = $this->makeProject(42);
        $other = $this->makeProject(77);
        [$task, $ref] = $this->taskWithRef($project);
        [$otherTask, $otherRef] = $this->taskWithRef($other);

        $this->actingAs($this->owner)
            ->delete(route('teams.gitlab-projects.destroy', [$this->team, $project]))
            ->assertRedirect();

        $this->assertDatabaseMissing('gitlab_projects', ['id' => $project->id]);
        $this->assertDatabaseMissing('task_gitlab_refs', ['id' => $ref->id]);
        $this->assertNull($task->fresh()->gitlab_project_id);

        // Tasks on other projects are untouched.
        $this->assertDatabaseHas('task_gitlab_refs', ['id' => $otherRef->id]);
        $this->assertSame($other->id, $otherTask->fresh()->gitlab_project_id);

        Http::assertSent(fn ($request) => $request->method() === 'DELETE'
            && str_contains($request->url(), '/projects/42/hooks/1042'));
    }

    public function test_deleting_a_connection_removes_refs_for_all_its_projects(): void
    {
        $otherConnection = GitlabConnection::create([
            'team_id' => $this->team->id,
            'name' => 'Other GitLab',
            'base_url' => 'https://gitlab.other.example.com',
            'api_token' => 'token',
            'webhook_secret' => 'secret',
            'is_active' => true,
        ]);
        [, $firstRef] = $this->taskWithRef($this->makeProject(42));
        [, $secondRef] = $this->taskWithRef($this->makeProject(43));
        [, $keptRef] = $this->taskWithRef($this->makeProject(44, $otherConnection));

        $this->actingAs($this->owner)
            ->delete(route('teams.gitlab-connections.destroy', [$this->team, $this->connection]))
            ->assertRedirect();

        $this->assertDatabaseMissing('gitlab_connections', ['id' => $this->connection->id]);
        $this->assertDatabaseMissing('task_gitlab_refs', ['id' => $firstRef->id]);
        $this->assertDatabaseMissing('task_gitlab_refs', ['id' => $secondRef->id]);
        $this->assertDatabaseHas('task_gitlab_refs', ['id' => $keptRef->id]);
    }
}
