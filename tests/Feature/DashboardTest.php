<?php

namespace Tests\Feature;

use App\Models\Board;
use App\Models\Column;
use App\Models\Task;
use App\Models\Team;
use App\Models\TeamMember;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DashboardTest extends TestCase
{
    use RefreshDatabase;

    private User $user;

    private Team $team;

    private Board $board;

    private Column $column;

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
        $this->column = Column::factory()->create(['board_id' => $this->board->id]);
    }

    public function test_can_view_dashboard(): void
    {
        $response = $this->actingAs($this->user)
            ->get(route('dashboard'));

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page->component('Dashboard'));
    }

    public function test_dashboard_shares_reverb_client_config(): void
    {
        config()->set('reverb.client', [
            'key' => 'client-key',
            'host' => 'ws.local.test',
            'port' => 9080,
            'scheme' => 'http',
        ]);

        $response = $this->actingAs($this->user)
            ->get(route('dashboard'));

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->component('Dashboard')
            ->where('reverb.key', 'client-key')
            ->where('reverb.host', 'ws.local.test')
            ->where('reverb.port', 9080)
            ->where('reverb.scheme', 'http'));
    }

    /**
     * Skipped: the stats endpoint uses MySQL-only YEARWEEK() which doesn't work in SQLite.
     */
    public function test_can_view_team_stats(): void
    {
        $this->markTestSkipped('Stats endpoint uses MySQL-only YEARWEEK() function.');
    }

    public function test_can_export_csv(): void
    {
        Task::factory()->create([
            'board_id' => $this->board->id,
            'column_id' => $this->column->id,
            'created_by' => $this->user->id,
            'title' => 'Export me',
        ]);

        $response = $this->actingAs($this->user)
            ->get(route('teams.export.csv', $this->team));

        $response->assertOk();
        $response->assertHeader('content-type', 'text/csv; charset=utf-8');
        $response->assertDownload();
    }
}
