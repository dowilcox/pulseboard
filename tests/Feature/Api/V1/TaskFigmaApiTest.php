<?php

namespace Tests\Feature\Api\V1;

use App\Models\Board;
use App\Models\Column;
use App\Models\FigmaConnection;
use App\Models\Task;
use App\Models\TaskFigmaLink;
use App\Models\Team;
use App\Models\TeamMember;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class TaskFigmaApiTest extends TestCase
{
    use RefreshDatabase;

    private User $user;

    private Team $team;

    private Board $board;

    private Column $column;

    private Task $task;

    private FigmaConnection $connection;

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
        ]);
        $this->connection = $this->createConnection($this->team);
        $this->token = $this->user->createToken('test', ['read', 'write'])->plainTextToken;
    }

    private function api(): static
    {
        return $this->withHeader('Authorization', "Bearer {$this->token}");
    }

    private function baseUrl(): string
    {
        return "/api/v1/teams/{$this->team->id}/boards/{$this->board->id}/tasks/{$this->task->id}/figma";
    }

    private function createConnection(Team $team, bool $isActive = true): FigmaConnection
    {
        return FigmaConnection::create([
            'team_id' => $team->id,
            'name' => 'Team Figma',
            'api_token' => 'token',
            'is_active' => $isActive,
        ]);
    }

    private function createLink(Task $task): TaskFigmaLink
    {
        return TaskFigmaLink::create([
            'task_id' => $task->id,
            'figma_connection_id' => $this->connection->id,
            'file_key' => 'abc123XYZ',
            'name' => 'Design File',
            'url' => 'https://www.figma.com/design/abc123XYZ/Design-File',
        ]);
    }

    public function test_index_lists_figma_links(): void
    {
        $this->createLink($this->task);
        $this->createLink($this->task);

        $response = $this->api()->getJson($this->baseUrl());

        $response->assertOk();
        $response->assertJsonCount(2, 'data');
        $response->assertJsonStructure([
            'data' => [['id', 'task_id', 'figma_connection_id', 'file_key', 'name', 'url', 'figma_connection']],
        ]);
    }

    public function test_store_links_figma_file(): void
    {
        Http::fake([
            'api.figma.com/v1/files/abc123XYZ/meta' => Http::response([
                'file' => [
                    'name' => 'Design File',
                    'thumbnail_url' => 'https://figma-thumbs.example.com/abc123XYZ.png',
                    'last_modified' => '2026-01-01T00:00:00Z',
                ],
            ]),
        ]);

        $response = $this->api()->postJson($this->baseUrl(), [
            'figma_connection_id' => $this->connection->id,
            'url' => 'https://www.figma.com/design/abc123XYZ/Design-File',
        ]);

        $response->assertCreated();
        $response->assertJsonPath('data.file_key', 'abc123XYZ');
        $response->assertJsonPath('data.name', 'Design File');
        $response->assertJsonPath('data.thumbnail_url', 'https://figma-thumbs.example.com/abc123XYZ.png');
        $response->assertJsonPath('data.figma_connection.id', $this->connection->id);
        $this->assertDatabaseHas('task_figma_links', [
            'task_id' => $this->task->id,
            'file_key' => 'abc123XYZ',
        ]);
    }

    public function test_store_rejects_non_figma_url(): void
    {
        Http::fake();

        $response = $this->api()->postJson($this->baseUrl(), [
            'figma_connection_id' => $this->connection->id,
            'url' => 'https://example.com/not-figma',
        ]);

        $response->assertStatus(422);
        $response->assertJsonStructure(['error']);
        Http::assertNothingSent();
        $this->assertDatabaseMissing('task_figma_links', ['task_id' => $this->task->id]);
    }

    public function test_store_returns_422_when_figma_api_fails(): void
    {
        Http::fake([
            'api.figma.com/v1/files/abc123XYZ/meta' => Http::response([
                'message' => 'Invalid token',
            ], 403),
        ]);

        $response = $this->api()->postJson($this->baseUrl(), [
            'figma_connection_id' => $this->connection->id,
            'url' => 'https://www.figma.com/design/abc123XYZ/Design-File',
        ]);

        $response->assertStatus(422);
        $this->assertStringContainsString('Invalid token', $response->json('error'));
        $this->assertDatabaseMissing('task_figma_links', ['task_id' => $this->task->id]);
    }

    public function test_store_rejects_connection_from_another_team(): void
    {
        $foreignTeam = Team::factory()->create();
        $foreignConnection = $this->createConnection($foreignTeam);

        Http::fake();

        $response = $this->api()->postJson($this->baseUrl(), [
            'figma_connection_id' => $foreignConnection->id,
            'url' => 'https://www.figma.com/design/abc123XYZ/Design-File',
        ]);

        $response->assertNotFound();
        Http::assertNothingSent();
        $this->assertDatabaseMissing('task_figma_links', ['task_id' => $this->task->id]);
    }

    public function test_store_rejects_inactive_connection(): void
    {
        $inactive = $this->createConnection($this->team, isActive: false);

        Http::fake();

        $response = $this->api()->postJson($this->baseUrl(), [
            'figma_connection_id' => $inactive->id,
            'url' => 'https://www.figma.com/design/abc123XYZ/Design-File',
        ]);

        $response->assertNotFound();
        Http::assertNothingSent();
    }

    public function test_destroy_link(): void
    {
        $link = $this->createLink($this->task);

        $response = $this->api()->deleteJson("{$this->baseUrl()}/{$link->id}");

        $response->assertNoContent();
        $this->assertDatabaseMissing('task_figma_links', ['id' => $link->id]);
    }

    public function test_destroy_link_scoped_to_task(): void
    {
        $otherTask = Task::factory()->create([
            'board_id' => $this->board->id,
            'column_id' => $this->column->id,
            'created_by' => $this->user->id,
        ]);
        $foreignLink = $this->createLink($otherTask);

        $response = $this->api()->deleteJson("{$this->baseUrl()}/{$foreignLink->id}");

        $response->assertNotFound();
        $this->assertDatabaseHas('task_figma_links', ['id' => $foreignLink->id]);
    }

    public function test_write_endpoints_require_write_ability(): void
    {
        $readToken = $this->user->createToken('read-only', ['read'])->plainTextToken;
        $api = fn () => $this->withHeader('Authorization', "Bearer {$readToken}");

        $api()->postJson($this->baseUrl(), [
            'figma_connection_id' => $this->connection->id,
            'url' => 'https://www.figma.com/design/abc123XYZ/Design-File',
        ])->assertForbidden();

        $link = $this->createLink($this->task);
        $api()->deleteJson("{$this->baseUrl()}/{$link->id}")->assertForbidden();

        // Reads still work with a read-only token
        $api()->getJson($this->baseUrl())->assertOk();
    }
}
