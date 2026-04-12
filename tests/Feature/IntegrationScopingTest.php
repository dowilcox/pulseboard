<?php

namespace Tests\Feature;

use App\Models\Board;
use App\Models\Column;
use App\Models\FigmaConnection;
use App\Models\GitlabConnection;
use App\Models\Task;
use App\Models\TaskFigmaLink;
use App\Models\TaskGitlabRef;
use App\Models\Team;
use App\Models\TeamMember;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class IntegrationScopingTest extends TestCase
{
    use RefreshDatabase;

    private User $user;

    private Team $team;

    private Team $otherTeam;

    private Board $board;

    private Column $column;

    private Task $task;

    protected function setUp(): void
    {
        parent::setUp();

        $this->user = User::factory()->create();
        $this->team = Team::factory()->create();
        $this->otherTeam = Team::factory()->create();

        $this->addTeamMember($this->user, $this->team, 'owner');
        $this->addTeamMember($this->user, $this->otherTeam, 'owner');

        $this->board = Board::factory()->create(['team_id' => $this->team->id]);
        $this->column = Column::factory()->create(['board_id' => $this->board->id]);
        $this->task = Task::factory()->create([
            'board_id' => $this->board->id,
            'column_id' => $this->column->id,
            'created_by' => $this->user->id,
        ]);
    }

    public function test_gitlab_connection_route_is_scoped_to_the_current_team(): void
    {
        $foreignConnection = GitlabConnection::create([
            'team_id' => $this->otherTeam->id,
            'name' => 'Foreign Connection',
            'base_url' => 'https://gitlab.example.com',
            'api_token' => 'token',
            'webhook_secret' => 'secret',
            'is_active' => true,
        ]);

        $response = $this->actingAs($this->user)->put(
            route('teams.gitlab-connections.update', [$this->team, $foreignConnection]),
            [
                'name' => 'Updated Name',
                'base_url' => 'https://gitlab.example.com',
                'api_token' => '',
                'is_active' => true,
            ],
        );

        $response->assertNotFound();
        $foreignConnection->refresh();
        $this->assertSame('Foreign Connection', $foreignConnection->name);
    }

    public function test_figma_connection_route_is_scoped_to_the_current_team(): void
    {
        $foreignConnection = FigmaConnection::create([
            'team_id' => $this->otherTeam->id,
            'name' => 'Foreign Figma',
            'api_token' => 'token',
            'is_active' => true,
        ]);

        $response = $this->actingAs($this->user)->delete(
            route('teams.figma-connections.destroy', [$this->team, $foreignConnection]),
        );

        $response->assertNotFound();
        $this->assertDatabaseHas('figma_connections', ['id' => $foreignConnection->id]);
    }

    public function test_task_gitlab_ref_route_is_scoped_to_the_current_task(): void
    {
        $otherTask = Task::factory()->create([
            'board_id' => $this->board->id,
            'column_id' => $this->column->id,
            'created_by' => $this->user->id,
        ]);

        $foreignRef = TaskGitlabRef::create([
            'task_id' => $otherTask->id,
            'ref_type' => 'branch',
            'gitlab_ref' => 'feature/test',
            'title' => 'Foreign Ref',
            'url' => 'https://gitlab.example.com/project/-/tree/feature/test',
        ]);

        $response = $this->actingAs($this->user)->delete(
            route('tasks.gitlab.destroy', [$this->team, $this->board, $this->task, $foreignRef]),
        );

        $response->assertNotFound();
        $this->assertDatabaseHas('task_gitlab_refs', ['id' => $foreignRef->id]);
    }

    public function test_task_figma_link_route_is_scoped_to_the_current_task(): void
    {
        $connection = FigmaConnection::create([
            'team_id' => $this->team->id,
            'name' => 'Team Figma',
            'api_token' => 'token',
            'is_active' => true,
        ]);

        $otherTask = Task::factory()->create([
            'board_id' => $this->board->id,
            'column_id' => $this->column->id,
            'created_by' => $this->user->id,
        ]);

        $foreignLink = TaskFigmaLink::create([
            'task_id' => $otherTask->id,
            'figma_connection_id' => $connection->id,
            'file_key' => Str::random(12),
            'name' => 'Foreign Link',
            'url' => 'https://www.figma.com/file/example',
        ]);

        $response = $this->actingAs($this->user)->delete(
            route('tasks.figma.destroy', [$this->team, $this->board, $this->task, $foreignLink]),
        );

        $response->assertNotFound();
        $this->assertDatabaseHas('task_figma_links', ['id' => $foreignLink->id]);
    }

    private function addTeamMember(User $user, Team $team, string $role): void
    {
        TeamMember::create([
            'team_id' => $team->id,
            'user_id' => $user->id,
            'role' => $role,
        ]);
    }
}
