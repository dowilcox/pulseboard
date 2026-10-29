<?php

namespace Tests\Feature;

use App\Models\Board;
use App\Models\Column;
use App\Models\Team;
use App\Models\TeamMember;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * In production, browser page errors render the Inertia error page, but API
 * and MCP clients must keep JSON error responses (bootstrap/app.php).
 */
class JsonErrorResponsesTest extends TestCase
{
    use RefreshDatabase;

    /** A browser-like Accept header, so only the path decides the format. */
    private const HTML = ['Accept' => 'text/html'];

    protected function setUp(): void
    {
        parent::setUp();

        $this->app['env'] = 'production';
    }

    private function tokenFor(User $user, array $abilities = ['read']): array
    {
        return ['Authorization' => 'Bearer '.$user->createToken('t', $abilities)->plainTextToken];
    }

    public function test_api_404_is_json_in_production(): void
    {
        $user = User::factory()->create();

        $response = $this->withHeaders([...self::HTML, ...$this->tokenFor($user)])
            ->get('/api/v1/teams/does-not-exist');

        $response->assertNotFound();
        $this->assertStringContainsString('application/json', $response->headers->get('Content-Type'));
        $response->assertJsonStructure(['message']);
    }

    public function test_api_403_is_json_in_production(): void
    {
        $user = User::factory()->create();
        $team = Team::factory()->create();
        TeamMember::create(['team_id' => $team->id, 'user_id' => $user->id, 'role' => 'member']);
        $board = Board::factory()->create(['team_id' => $team->id]);
        $column = Column::factory()->create(['board_id' => $board->id]);

        // Read-only token on a write endpoint.
        $response = $this->withHeaders([...self::HTML, ...$this->tokenFor($user)])
            ->post("/api/v1/teams/{$team->id}/boards/{$board->id}/columns/{$column->id}/tasks", ['title' => 'x']);

        $response->assertForbidden();
        $this->assertStringContainsString('application/json', $response->headers->get('Content-Type'));
        $response->assertJsonStructure(['message']);
    }

    public function test_api_json_requests_keep_json_errors_in_production(): void
    {
        $user = User::factory()->create();

        $this->withHeaders($this->tokenFor($user))
            ->getJson('/api/v1/teams/does-not-exist')
            ->assertNotFound()
            ->assertJsonStructure(['message']);
    }

    public function test_mcp_errors_are_json_in_production(): void
    {
        // Unauthenticated: a JSON 401, not a redirect to the login page.
        $unauthenticated = $this->withHeaders(self::HTML)->post('/mcp', []);
        $unauthenticated->assertUnauthorized();
        $this->assertStringContainsString('application/json', $unauthenticated->headers->get('Content-Type'));

        $notFound = $this->actingAs(User::factory()->create())->withHeaders(self::HTML)->get('/mcp/unknown');
        $notFound->assertNotFound();
        $this->assertStringContainsString('application/json', $notFound->headers->get('Content-Type'));
        $notFound->assertJsonStructure(['message']);
    }

    public function test_browser_pages_still_get_the_inertia_error_page_in_production(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user)->withHeaders(self::HTML)->get('/no-such-team');

        $response->assertNotFound();
        $this->assertStringContainsString('text/html', $response->headers->get('Content-Type'));
        $this->assertStringContainsString('Error', $response->getContent());
    }
}
