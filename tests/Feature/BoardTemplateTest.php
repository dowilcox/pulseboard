<?php

namespace Tests\Feature;

use App\Models\Board;
use App\Models\BoardTemplate;
use App\Models\TaskTemplate;
use App\Models\Team;
use App\Models\TeamMember;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class BoardTemplateTest extends TestCase
{
    use RefreshDatabase;

    private User $user;

    private Team $team;

    protected function setUp(): void
    {
        parent::setUp();

        $this->user = User::factory()->create();
        $this->team = Team::factory()->create(['slug' => 'my-team']);
        TeamMember::create([
            'team_id' => $this->team->id,
            'user_id' => $this->user->id,
            'role' => 'owner',
        ]);
    }

    private function makeTemplate(User $creator): BoardTemplate
    {
        return BoardTemplate::create([
            'name' => 'Sprint Template',
            'description' => 'A template',
            'created_by' => $creator->id,
            'template_data' => [
                'columns' => [
                    ['name' => 'Backlog', 'color' => '#111111', 'wip_limit' => 5, 'is_done_column' => false],
                    ['name' => 'Doing', 'color' => '#222222', 'wip_limit' => null, 'is_done_column' => false],
                    ['name' => 'Finished', 'color' => '#333333', 'wip_limit' => null, 'is_done_column' => true],
                ],
            ],
        ]);
    }

    public function test_create_board_from_template_creates_routable_slugged_board(): void
    {
        $template = $this->makeTemplate($this->user);

        $response = $this->actingAs($this->user)->postJson(
            "/{$this->team->slug}/templates/{$template->id}/create-board",
            ['name' => 'Sprint Board'],
        );

        $response->assertCreated();

        $board = Board::where('team_id', $this->team->id)
            ->where('name', 'Sprint Board')
            ->firstOrFail();

        $this->assertSame('sprint-board', $board->slug);

        $columns = $board->columns()->orderBy('sort_order')->get();
        $this->assertCount(3, $columns);
        $this->assertSame(['Backlog', 'Doing', 'Finished'], $columns->pluck('name')->all());
        $this->assertSame(5, $columns[0]->wip_limit);
        $this->assertFalse((bool) $columns[0]->is_done_column);
        $this->assertTrue((bool) $columns[2]->is_done_column);

        // The board is routable by its slug.
        $this->actingAs($this->user)
            ->get("/{$this->team->slug}/{$board->slug}")
            ->assertOk();
    }

    public function test_board_from_template_slug_is_unique_within_team(): void
    {
        Board::factory()->create([
            'team_id' => $this->team->id,
            'slug' => 'sprint-board',
        ]);

        $template = $this->makeTemplate($this->user);

        $this->actingAs($this->user)
            ->postJson(
                "/{$this->team->slug}/templates/{$template->id}/create-board",
                ['name' => 'Sprint Board'],
            )
            ->assertCreated();

        $board = Board::where('team_id', $this->team->id)
            ->where('name', 'Sprint Board')
            ->whereNot('slug', 'sprint-board')
            ->firstOrFail();

        $this->assertSame('sprint-board-1', $board->slug);
    }

    public function test_cannot_create_board_from_another_users_template(): void
    {
        $otherUser = User::factory()->create();
        $template = $this->makeTemplate($otherUser);

        $this->actingAs($this->user)
            ->postJson(
                "/{$this->team->slug}/templates/{$template->id}/create-board",
                ['name' => 'Sprint Board'],
            )
            ->assertForbidden();

        $this->assertDatabaseMissing('boards', [
            'team_id' => $this->team->id,
            'name' => 'Sprint Board',
        ]);
    }

    public function test_app_admin_can_use_another_users_template(): void
    {
        $admin = User::factory()->create(['is_admin' => true]);
        TeamMember::create([
            'team_id' => $this->team->id,
            'user_id' => $admin->id,
            'role' => 'owner',
        ]);

        $otherUser = User::factory()->create();
        $template = $this->makeTemplate($otherUser);

        $this->actingAs($admin)
            ->postJson(
                "/{$this->team->slug}/templates/{$template->id}/create-board",
                ['name' => 'Admin Board'],
            )
            ->assertCreated();
    }

    public function test_cross_team_default_task_template_is_rejected(): void
    {
        $board = Board::factory()->create([
            'team_id' => $this->team->id,
            'slug' => 'my-board',
        ]);

        $otherTeam = Team::factory()->create(['slug' => 'other-team']);
        $foreignTemplate = TaskTemplate::create([
            'team_id' => $otherTeam->id,
            'name' => 'Foreign Template',
            'created_by' => $this->user->id,
        ]);

        $this->actingAs($this->user)
            ->putJson("/{$this->team->slug}/{$board->slug}", [
                'default_task_template_id' => $foreignTemplate->id,
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('default_task_template_id');

        $this->assertNull($board->fresh()->default_task_template_id);
    }

    public function test_same_team_default_task_template_is_accepted(): void
    {
        $board = Board::factory()->create([
            'team_id' => $this->team->id,
            'slug' => 'my-board',
        ]);

        $template = TaskTemplate::create([
            'team_id' => $this->team->id,
            'name' => 'Own Template',
            'created_by' => $this->user->id,
        ]);

        $this->actingAs($this->user)
            ->put("/{$this->team->slug}/{$board->slug}", [
                'default_task_template_id' => $template->id,
            ])
            ->assertSessionHasNoErrors();

        $this->assertSame($template->id, $board->fresh()->default_task_template_id);
    }
}
