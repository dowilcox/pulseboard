<?php

namespace Tests\Feature\Api\V1;

use App\Models\Board;
use App\Models\Column;
use App\Models\Team;
use App\Models\TeamMember;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class BoardManagementApiTest extends TestCase
{
    use RefreshDatabase;

    private User $user;

    private Team $team;

    private Board $board;

    private string $token;

    protected function setUp(): void
    {
        parent::setUp();

        $this->user = User::factory()->create();
        $this->team = Team::factory()->create();
        TeamMember::create(['team_id' => $this->team->id, 'user_id' => $this->user->id, 'role' => 'owner']);
        $this->board = Board::factory()->create(['team_id' => $this->team->id]);
        Column::factory()->create(['board_id' => $this->board->id]);
        $this->token = $this->user->createToken('test', ['read', 'write', 'manage'])->plainTextToken;
    }

    private function api(): static
    {
        return $this->withHeader('Authorization', "Bearer {$this->token}");
    }

    private function memberApi(): static
    {
        $member = User::factory()->create();
        TeamMember::create(['team_id' => $this->team->id, 'user_id' => $member->id, 'role' => 'member']);
        $token = $member->createToken('member', ['read', 'write', 'manage'])->plainTextToken;

        return $this->withHeader('Authorization', "Bearer {$token}");
    }

    public function test_create_board(): void
    {
        $response = $this->api()->postJson("/api/v1/teams/{$this->team->id}/boards", [
            'name' => 'API Board',
            'description' => 'Created via API',
        ]);

        $response->assertCreated();
        $response->assertJsonPath('data.name', 'API Board');
        $response->assertJsonPath('data.description', 'Created via API');
        // Default columns are created with the board
        $response->assertJsonCount(4, 'data.columns');
        $this->assertDatabaseHas('boards', ['name' => 'API Board', 'team_id' => $this->team->id]);
    }

    public function test_create_board_requires_name(): void
    {
        $response = $this->api()->postJson("/api/v1/teams/{$this->team->id}/boards", []);

        $response->assertUnprocessable();
        $response->assertJsonValidationErrors(['name']);
    }

    public function test_regular_member_can_create_board(): void
    {
        // BoardPolicy::create allows any team member (parity with web).
        $response = $this->memberApi()->postJson("/api/v1/teams/{$this->team->id}/boards", [
            'name' => 'Member Board',
        ]);

        $response->assertCreated();
    }

    public function test_create_board_requires_manage_ability(): void
    {
        $writeToken = $this->user->createToken('write-only', ['read', 'write'])->plainTextToken;

        $response = $this->withHeader('Authorization', "Bearer {$writeToken}")
            ->postJson("/api/v1/teams/{$this->team->id}/boards", ['name' => 'Nope']);

        $response->assertForbidden();
    }

    public function test_update_board(): void
    {
        $response = $this->api()->putJson(
            "/api/v1/teams/{$this->team->id}/boards/{$this->board->id}",
            ['name' => 'Renamed Board', 'description' => 'New description']
        );

        $response->assertOk();
        $response->assertJsonPath('data.name', 'Renamed Board');
        $response->assertJsonPath('data.description', 'New description');
    }

    public function test_update_board_settings(): void
    {
        $response = $this->api()->putJson(
            "/api/v1/teams/{$this->team->id}/boards/{$this->board->id}",
            ['settings' => ['auto_move_to_done' => true]]
        );

        $response->assertOk();
        $this->assertTrue($this->board->fresh()->settings['auto_move_to_done']);
    }

    public function test_regular_member_cannot_update_board(): void
    {
        $response = $this->memberApi()->putJson(
            "/api/v1/teams/{$this->team->id}/boards/{$this->board->id}",
            ['name' => 'Nope']
        );

        $response->assertForbidden();
    }

    public function test_archive_board(): void
    {
        $response = $this->api()->postJson(
            "/api/v1/teams/{$this->team->id}/boards/{$this->board->id}/archive"
        );

        $response->assertOk();
        $response->assertJsonPath('data.is_archived', true);
        $this->assertTrue($this->board->fresh()->is_archived);
    }

    public function test_regular_member_cannot_archive_board(): void
    {
        $response = $this->memberApi()->postJson(
            "/api/v1/teams/{$this->team->id}/boards/{$this->board->id}/archive"
        );

        $response->assertForbidden();
    }

    public function test_delete_board(): void
    {
        $response = $this->api()->deleteJson(
            "/api/v1/teams/{$this->team->id}/boards/{$this->board->id}",
            ['confirmation' => 'DELETE']
        );

        $response->assertNoContent();
        $this->assertDatabaseMissing('boards', ['id' => $this->board->id]);
    }

    public function test_delete_board_requires_confirmation(): void
    {
        $response = $this->api()->deleteJson(
            "/api/v1/teams/{$this->team->id}/boards/{$this->board->id}"
        );

        $response->assertUnprocessable();
        $response->assertJsonValidationErrors(['confirmation']);
        $this->assertDatabaseHas('boards', ['id' => $this->board->id]);
    }

    public function test_regular_member_cannot_delete_board(): void
    {
        $response = $this->memberApi()->deleteJson(
            "/api/v1/teams/{$this->team->id}/boards/{$this->board->id}",
            ['confirmation' => 'DELETE']
        );

        $response->assertForbidden();
    }

    public function test_update_board_requires_manage_ability(): void
    {
        $writeToken = $this->user->createToken('write-only', ['read', 'write'])->plainTextToken;

        $response = $this->withHeader('Authorization', "Bearer {$writeToken}")->putJson(
            "/api/v1/teams/{$this->team->id}/boards/{$this->board->id}",
            ['name' => 'Nope']
        );

        $response->assertForbidden();
    }
}
