<?php

namespace Tests\Feature\Mcp;

use App\Models\Activity;
use App\Models\Board;
use App\Models\Column;
use App\Models\Task;
use App\Models\Team;
use App\Support\UniqueSlug;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Testing\TestResponse;
use Tests\Feature\Mcp\Concerns\InteractsWithMcp;
use Tests\TestCase;

/**
 * End-to-end tests against the real /mcp endpoint with Sanctum bearer
 * tokens and JSON-RPC payloads, as an MCP client (Claude Code etc.) sends them.
 */
class McpHttpTest extends TestCase
{
    use InteractsWithMcp;
    use RefreshDatabase;

    private const PROTOCOL = '2025-06-18';

    private function rpc(?string $token, string $method, array $params = [], int $id = 1): TestResponse
    {
        $headers = [
            'Accept' => 'application/json, text/event-stream',
            'MCP-Protocol-Version' => self::PROTOCOL,
        ];

        if ($token !== null) {
            $headers['Authorization'] = "Bearer {$token}";
        }

        return $this->withHeaders($headers)->postJson('/mcp', [
            'jsonrpc' => '2.0',
            'id' => $id,
            'method' => $method,
            'params' => (object) $params,
        ]);
    }

    private function httpTool(?string $token, string $name, array $arguments = []): TestResponse
    {
        return $this->rpc($token, 'tools/call', ['name' => $name, 'arguments' => (object) $arguments]);
    }

    private function toolPayload(TestResponse $response): array
    {
        $response->assertOk();
        $response->assertJsonPath('result.isError', false);

        return json_decode($response->json('result.content.0.text'), true, flags: JSON_THROW_ON_ERROR);
    }

    public function test_unauthenticated_requests_are_rejected_with_401(): void
    {
        $response = $this->rpc(null, 'initialize', [
            'protocolVersion' => self::PROTOCOL,
            'capabilities' => (object) [],
            'clientInfo' => ['name' => 'test', 'version' => '1.0'],
        ]);

        $response->assertUnauthorized();
        $this->assertStringContainsString('Bearer', (string) $response->headers->get('WWW-Authenticate'));
    }

    public function test_invalid_token_is_rejected(): void
    {
        $this->rpc('1|not-a-real-token', 'tools/list')->assertUnauthorized();
    }

    public function test_initialize_and_list_tools(): void
    {
        $user = $this->memberOf(Team::factory()->create());
        $token = $user->createToken('agent', ['read'])->plainTextToken;

        $init = $this->rpc($token, 'initialize', [
            'protocolVersion' => self::PROTOCOL,
            'capabilities' => (object) [],
            'clientInfo' => ['name' => 'test', 'version' => '1.0'],
        ]);

        $init->assertOk()
            ->assertJsonPath('result.protocolVersion', self::PROTOCOL)
            ->assertJsonPath('result.serverInfo.name', 'PulseBoard');
        $this->assertStringContainsString('untrusted', $init->json('result.instructions'));

        $list = $this->rpc($token, 'tools/list', [], 2)->assertOk();
        $tools = collect($list->json('result.tools'))->keyBy('name');

        foreach ([
            'whoami', 'list_teams', 'list_boards', 'get_board', 'list_tasks', 'get_task', 'search_tasks',
            'my_tasks', 'list_comments', 'get_board_activity', 'list_notifications', 'create_task',
            'update_task', 'move_task', 'complete_task', 'assign_task', 'set_task_labels', 'add_comment',
            'add_dependency', 'remove_dependency', 'update_checklist', 'delete_task', 'mark_notifications_read',
        ] as $name) {
            $this->assertTrue($tools->has($name), "Tool [{$name}] is not listed.");
        }

        $this->assertNull($list->json('result.nextCursor'), 'All tools should be served in one page.');
        $this->assertTrue($tools['list_tasks']['annotations']['readOnlyHint']);
        $this->assertTrue($tools['delete_task']['annotations']['destructiveHint']);
        $this->assertContains('board', $tools['list_tasks']['inputSchema']['required']);
    }

    public function test_tools_call_returns_only_the_users_teams(): void
    {
        $team = Team::factory()->create(['slug' => 'acme']);
        $other = Team::factory()->create(['slug' => 'globex']);
        Board::factory()->create(['team_id' => $team->id, 'slug' => 'roadmap', 'name' => 'Roadmap']);
        Board::factory()->create(['team_id' => $other->id, 'slug' => 'secret', 'name' => 'Secret Plans']);
        $user = $this->memberOf($team);
        $token = $user->createToken('agent', ['read'])->plainTextToken;

        $payload = $this->toolPayload($this->httpTool($token, 'list_boards'));

        $this->assertSame(['roadmap'], array_column($payload['boards'], 'slug'));

        $response = $this->httpTool($token, 'get_board', ['board' => 'secret', 'team' => 'globex']);
        $response->assertOk()->assertJsonPath('result.isError', true);
        $this->assertStringNotContainsString('Secret Plans', $response->getContent());
    }

    public function test_read_only_token_cannot_call_write_tools(): void
    {
        $team = Team::factory()->create();
        $board = Board::factory()->create(['team_id' => $team->id, 'slug' => 'roadmap']);
        Column::factory()->create(['board_id' => $board->id, 'sort_order' => 0]);
        $user = $this->memberOf($team);
        $token = $user->createToken('agent', ['read'])->plainTextToken;

        $response = $this->httpTool($token, 'create_task', ['board' => $board->id, 'title' => 'Nope']);

        $response->assertOk()->assertJsonPath('result.isError', true);
        $this->assertStringContainsString('"write" ability', $response->json('result.content.0.text'));
        $this->assertDatabaseMissing('tasks', ['title' => 'Nope']);
    }

    public function test_write_token_creates_a_task_through_the_action(): void
    {
        $team = Team::factory()->create(['slug' => 'acme']);
        $board = Board::factory()->create(['team_id' => $team->id, 'slug' => 'roadmap']);
        $column = Column::factory()->create(['board_id' => $board->id, 'sort_order' => 0, 'name' => 'Backlog']);
        $user = $this->memberOf($team);
        $token = $user->createToken('agent', ['read', 'write'])->plainTextToken;

        $payload = $this->toolPayload($this->httpTool($token, 'create_task', [
            'board' => 'acme/roadmap',
            'title' => 'Write the docs',
            'description' => "## Plan\n\n- one\n- two",
        ]));

        $task = Task::where('title', 'Write the docs')->firstOrFail();
        $this->assertSame($column->id, $task->column_id);
        $this->assertSame($user->id, $task->created_by);
        $this->assertSame($task->id, $payload['task']['id']);
        $this->assertSame('roadmap#'.$task->task_number, $payload['task']['ref']);
        $this->assertStringContainsString('/acme/roadmap/tasks/', $payload['task']['url']);
        $this->assertTrue(Activity::where('task_id', $task->id)->where('action', 'created')->where('user_id', $user->id)->exists());
    }

    public function test_deactivated_users_are_rejected(): void
    {
        $user = $this->memberOf(Team::factory()->create(), attributes: ['deactivated_at' => now()]);
        $token = $user->createToken('agent', ['read'])->plainTextToken;

        $this->rpc($token, 'tools/list')->assertForbidden();
    }

    public function test_get_requests_are_not_allowed(): void
    {
        $this->get('/mcp')->assertStatus(405);
    }

    public function test_mcp_is_a_reserved_team_slug(): void
    {
        $this->assertContains('mcp', UniqueSlug::RESERVED_TEAM_SLUGS);
        $this->assertNotSame('mcp', UniqueSlug::forTeam('MCP'));
    }
}
