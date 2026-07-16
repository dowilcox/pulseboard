<?php

namespace Tests\Feature\Api\V1;

use App\Models\Label;
use App\Models\Team;
use App\Models\TeamMember;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class LabelApiTest extends TestCase
{
    use RefreshDatabase;

    private User $user;

    private Team $team;

    private string $token;

    protected function setUp(): void
    {
        parent::setUp();

        $this->user = User::factory()->create();
        $this->team = Team::factory()->create();
        TeamMember::create(['team_id' => $this->team->id, 'user_id' => $this->user->id, 'role' => 'owner']);
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

    public function test_list_labels(): void
    {
        Label::factory()->create(['team_id' => $this->team->id, 'name' => 'Zebra']);
        Label::factory()->create(['team_id' => $this->team->id, 'name' => 'Alpha']);

        $response = $this->api()->getJson("/api/v1/teams/{$this->team->id}/labels");

        $response->assertOk();
        $response->assertJsonCount(2, 'data');
        // Ordered by name
        $response->assertJsonPath('data.0.name', 'Alpha');
        $response->assertJsonPath('data.1.name', 'Zebra');
    }

    public function test_create_label(): void
    {
        $response = $this->api()->postJson("/api/v1/teams/{$this->team->id}/labels", [
            'name' => 'Bug',
            'color' => '#ff0000',
        ]);

        $response->assertCreated();
        $response->assertJsonPath('data.name', 'Bug');
        $response->assertJsonPath('data.color', '#ff0000');
        $this->assertDatabaseHas('labels', ['name' => 'Bug', 'team_id' => $this->team->id]);
    }

    public function test_create_label_validates_color_format(): void
    {
        $response = $this->api()->postJson("/api/v1/teams/{$this->team->id}/labels", [
            'name' => 'Bug',
            'color' => 'red',
        ]);

        $response->assertUnprocessable();
        $response->assertJsonValidationErrors(['color']);
    }

    public function test_create_label_requires_manage_ability(): void
    {
        $writeToken = $this->user->createToken('write-only', ['read', 'write'])->plainTextToken;

        $response = $this->withHeader('Authorization', "Bearer {$writeToken}")->postJson(
            "/api/v1/teams/{$this->team->id}/labels",
            ['name' => 'Bug', 'color' => '#ff0000']
        );

        $response->assertForbidden();
    }

    public function test_regular_member_cannot_create_label(): void
    {
        $response = $this->memberApi()->postJson("/api/v1/teams/{$this->team->id}/labels", [
            'name' => 'Bug',
            'color' => '#ff0000',
        ]);

        $response->assertForbidden();
    }

    public function test_update_label(): void
    {
        $label = Label::factory()->create(['team_id' => $this->team->id]);

        $response = $this->api()->putJson(
            "/api/v1/teams/{$this->team->id}/labels/{$label->id}",
            ['name' => 'Renamed', 'color' => '#00ff00']
        );

        $response->assertOk();
        $response->assertJsonPath('data.name', 'Renamed');
        $response->assertJsonPath('data.color', '#00ff00');
    }

    public function test_update_label_from_another_team_returns_404(): void
    {
        $otherTeam = Team::factory()->create();
        $foreignLabel = Label::factory()->create(['team_id' => $otherTeam->id]);

        $response = $this->api()->putJson(
            "/api/v1/teams/{$this->team->id}/labels/{$foreignLabel->id}",
            ['name' => 'Nope']
        );

        $response->assertNotFound();
    }

    public function test_delete_label(): void
    {
        $label = Label::factory()->create(['team_id' => $this->team->id]);

        $response = $this->api()->deleteJson("/api/v1/teams/{$this->team->id}/labels/{$label->id}");

        $response->assertNoContent();
        $this->assertDatabaseMissing('labels', ['id' => $label->id]);
    }

    public function test_regular_member_cannot_delete_label(): void
    {
        $label = Label::factory()->create(['team_id' => $this->team->id]);

        $response = $this->memberApi()->deleteJson("/api/v1/teams/{$this->team->id}/labels/{$label->id}");

        $response->assertForbidden();
    }
}
