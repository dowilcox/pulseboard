<?php

namespace Tests\Feature\Api\V1;

use App\Models\Team;
use App\Models\TeamMember;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ApiAuthTest extends TestCase
{
    use RefreshDatabase;

    public function test_unauthenticated_request_returns_401(): void
    {
        $response = $this->getJson('/api/v1/me');

        $response->assertUnauthorized();
    }

    public function test_valid_token_authenticates_user(): void
    {
        $user = User::factory()->create();
        $token = $user->createToken('test', ['read'])->plainTextToken;

        $response = $this->withHeader('Authorization', "Bearer $token")
            ->getJson('/api/v1/me');

        $response->assertOk();
        $response->assertJsonPath('data.id', $user->id);
    }

    public function test_bot_user_can_authenticate(): void
    {
        $bot = User::factory()->create(['is_bot' => true]);
        $token = $bot->createToken('mcp-server', ['read', 'write'])->plainTextToken;

        $response = $this->withHeader('Authorization', "Bearer $token")
            ->getJson('/api/v1/me');

        $response->assertOk();
        $response->assertJsonPath('data.id', $bot->id);
        $response->assertJsonPath('data.is_bot', true);
    }

    public function test_read_token_cannot_access_write_endpoints(): void
    {
        $user = User::factory()->create();
        $team = Team::factory()->create();
        TeamMember::create(['team_id' => $team->id, 'user_id' => $user->id, 'role' => 'member']);
        $token = $user->createToken('read-only', ['read'])->plainTextToken;

        $board = \App\Models\Board::factory()->create(['team_id' => $team->id]);
        $column = \App\Models\Column::factory()->create(['board_id' => $board->id]);

        $response = $this->withHeader('Authorization', "Bearer $token")
            ->postJson("/api/v1/teams/{$team->id}/boards/{$board->id}/columns/{$column->id}/tasks", [
                'title' => 'Test task',
            ]);

        $response->assertForbidden();
    }

    public function test_write_token_can_access_write_endpoints(): void
    {
        $user = User::factory()->create();
        $team = Team::factory()->create();
        TeamMember::create(['team_id' => $team->id, 'user_id' => $user->id, 'role' => 'member']);
        $token = $user->createToken('full', ['read', 'write'])->plainTextToken;

        $board = \App\Models\Board::factory()->create(['team_id' => $team->id]);
        $column = \App\Models\Column::factory()->create(['board_id' => $board->id]);

        $response = $this->withHeader('Authorization', "Bearer $token")
            ->postJson("/api/v1/teams/{$team->id}/boards/{$board->id}/columns/{$column->id}/tasks", [
                'title' => 'Test task',
            ]);

        $response->assertCreated();
    }

    public function test_non_team_member_gets_403(): void
    {
        $user = User::factory()->create();
        $team = Team::factory()->create();
        $token = $user->createToken('test', ['read'])->plainTextToken;

        $response = $this->withHeader('Authorization', "Bearer $token")
            ->getJson("/api/v1/teams/{$team->id}");

        $response->assertForbidden();
    }
}
