<?php

namespace Tests\Feature;

use App\Models\Activity;
use App\Models\Board;
use App\Models\Column;
use App\Models\Task;
use App\Models\Team;
use App\Models\TeamMember;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

/**
 * Team page (Teams/Show), archiving/restoring boards and the Teams index counts.
 */
class TeamPageTest extends TestCase
{
    use RefreshDatabase;

    private Team $team;

    private User $owner;

    private User $admin;

    private User $member;

    protected function setUp(): void
    {
        parent::setUp();

        $this->team = Team::factory()->create(['slug' => 'acme']);
        $this->owner = $this->addMember('owner');
        $this->admin = $this->addMember('admin');
        $this->member = $this->addMember('member');
    }

    private function addMember(string $role, ?Team $team = null): User
    {
        $user = User::factory()->create();
        TeamMember::create([
            'team_id' => ($team ?? $this->team)->id,
            'user_id' => $user->id,
            'role' => $role,
        ]);

        return $user;
    }

    private function board(array $attributes = []): Board
    {
        return Board::factory()->create(['team_id' => $this->team->id, ...$attributes]);
    }

    // ---------------------------------------------------------------
    // Team page
    // ---------------------------------------------------------------

    public function test_team_page_lists_active_boards_with_task_stats(): void
    {
        $board = $this->board(['name' => 'Roadmap', 'slug' => 'roadmap']);
        $column = Column::factory()->create(['board_id' => $board->id]);

        $makeTask = fn (array $attributes) => Task::factory()->create([
            'board_id' => $board->id,
            'column_id' => $column->id,
            'due_date' => null,
            'completed_at' => null,
            ...$attributes,
        ]);

        $makeTask([]);
        $makeTask(['due_date' => now()->subDays(3)->toDateString()]);
        $makeTask(['due_date' => now()->toDateString()]); // due today: not overdue
        $makeTask(['due_date' => now()->subDays(3)->toDateString(), 'completed_at' => now()]);

        $this->board(['is_archived' => true, 'name' => 'Old', 'slug' => 'old']);

        $this->actingAs($this->member)
            ->get(route('teams.show', $this->team))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Teams/Show')
                ->has('boards', 1)
                ->where('boards.0.slug', 'roadmap')
                ->where('boards.0.open_tasks_count', 3)
                ->where('boards.0.overdue_tasks_count', 1)
                ->where('boards.0.completed_tasks_count', 1)
                ->has('boards.0.last_activity_at')
                ->missing('boards.0.tasks_max_updated_at')
                ->has('archivedBoards', 1)
                ->where('archivedBoards.0.slug', 'old')
            );
    }

    public function test_last_activity_uses_the_latest_task_activity(): void
    {
        $board = $this->board(['updated_at' => now()->subDays(10)]);
        $column = Column::factory()->create(['board_id' => $board->id]);
        $task = Task::factory()->create([
            'board_id' => $board->id,
            'column_id' => $column->id,
            'updated_at' => now()->subDays(5),
        ]);
        $board->forceFill(['updated_at' => now()->subDays(10)])->saveQuietly();

        $commentedAt = now()->subHours(2)->startOfSecond();
        Activity::create([
            'task_id' => $task->id,
            'user_id' => $this->member->id,
            'action' => 'commented',
            'created_at' => $commentedAt,
        ]);

        $this->actingAs($this->member)
            ->get(route('teams.show', $this->team))
            ->assertInertia(fn (Assert $page) => $page
                ->where('boards.0.last_activity_at', $commentedAt->toIso8601String())
            );
    }

    public function test_member_gets_member_permissions_on_team_page(): void
    {
        $this->actingAs($this->member)
            ->get(route('teams.show', $this->team))
            ->assertInertia(fn (Assert $page) => $page
                ->where('can.createBoard', true)
                ->where('can.createFromTemplate', false)
                ->where('can.manageTeam', false)
                ->where('can.manageIntegrations', false)
                ->where('can.restoreBoards', false)
                ->where('can.exportCsv', true)
            );
    }

    public function test_admin_gets_admin_permissions_on_team_page(): void
    {
        $this->board(['is_archived' => true]);

        $this->actingAs($this->admin)
            ->get(route('teams.show', $this->team))
            ->assertInertia(fn (Assert $page) => $page
                ->where('can.createBoard', true)
                ->where('can.createFromTemplate', true)
                ->where('can.manageTeam', true)
                ->where('can.manageIntegrations', true)
                ->where('can.restoreBoards', true)
            );
    }

    // ---------------------------------------------------------------
    // Archive / unarchive
    // ---------------------------------------------------------------

    public function test_archive_redirects_to_team_page_with_flash(): void
    {
        $board = $this->board(['name' => 'Launch']);

        $this->actingAs($this->admin)
            ->post(route('teams.boards.archive', [$this->team, $board]))
            ->assertRedirect(route('teams.show', $this->team))
            ->assertSessionHas('success', fn (string $message) => str_contains($message, 'Launch'));

        $this->assertTrue($board->fresh()->is_archived);
    }

    public function test_member_cannot_archive_board(): void
    {
        $board = $this->board();

        $this->actingAs($this->member)
            ->post(route('teams.boards.archive', [$this->team, $board]))
            ->assertForbidden();

        $this->assertFalse($board->fresh()->is_archived);
    }

    public function test_admin_can_restore_archived_board(): void
    {
        $board = $this->board(['is_archived' => true, 'name' => 'Launch']);

        $this->actingAs($this->admin)
            ->from(route('teams.show', $this->team))
            ->post(route('teams.boards.unarchive', [$this->team, $board]))
            ->assertRedirect(route('teams.show', $this->team))
            ->assertSessionHas('success', 'Board “Launch” restored.');

        $this->assertFalse($board->fresh()->is_archived);
    }

    public function test_member_cannot_restore_archived_board(): void
    {
        $board = $this->board(['is_archived' => true]);

        $this->actingAs($this->member)
            ->post(route('teams.boards.unarchive', [$this->team, $board]))
            ->assertForbidden();

        $this->assertTrue($board->fresh()->is_archived);
    }

    public function test_non_member_cannot_restore_archived_board(): void
    {
        $board = $this->board(['is_archived' => true]);
        $outsider = User::factory()->create();

        $this->actingAs($outsider)
            ->post(route('teams.boards.unarchive', [$this->team, $board]))
            ->assertForbidden();

        $this->assertTrue($board->fresh()->is_archived);
    }

    public function test_restored_board_is_listed_on_team_page_again(): void
    {
        $board = $this->board(['is_archived' => true]);

        $this->actingAs($this->owner)
            ->post(route('teams.boards.unarchive', [$this->team, $board]));

        $this->actingAs($this->owner)
            ->get(route('teams.show', $this->team))
            ->assertInertia(fn (Assert $page) => $page
                ->has('boards', 1)
                ->has('archivedBoards', 0)
            );
    }

    // ---------------------------------------------------------------
    // Teams index counts
    // ---------------------------------------------------------------

    public function test_teams_index_board_count_excludes_archived_boards(): void
    {
        $this->board();
        $this->board();
        $this->board(['is_archived' => true]);

        $deactivated = $this->addMember('member');
        $deactivated->update(['deactivated_at' => now()]);

        $this->actingAs($this->owner)
            ->get(route('teams.index'))
            ->assertInertia(fn (Assert $page) => $page
                ->component('Teams/Index')
                ->where('pageTeams.0.boards_count', 2)
                // owner, admin, member — the deactivated account is not counted
                ->where('pageTeams.0.members_count', 3)
            );
    }

    public function test_create_board_redirects_to_board_with_flash(): void
    {
        $response = $this->actingAs($this->member)
            ->post(route('teams.boards.store', $this->team), ['name' => 'Fresh Board']);

        $board = Board::where('team_id', $this->team->id)->where('name', 'Fresh Board')->firstOrFail();

        $response->assertRedirect(route('teams.boards.show', [$this->team, $board]))
            ->assertSessionHas('success', 'Board “Fresh Board” created.');
    }

    public function test_create_board_validation_errors_return_to_form(): void
    {
        $this->actingAs($this->member)
            ->from(route('teams.show', $this->team))
            ->post(route('teams.boards.store', $this->team), ['name' => ''])
            ->assertRedirect(route('teams.show', $this->team))
            ->assertSessionHasErrors('name');
    }
}
