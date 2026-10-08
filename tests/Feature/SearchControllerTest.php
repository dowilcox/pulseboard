<?php

namespace Tests\Feature;

use App\Models\Board;
use App\Models\Column;
use App\Models\Task;
use App\Models\Team;
use App\Models\TeamMember;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;
use Tests\TestCase;

class SearchControllerTest extends TestCase
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
        $this->team = Team::factory()->create(['name' => 'Engineering', 'slug' => 'engineering']);
        $this->addMember($this->team, $this->user);
        $this->board = Board::factory()->create([
            'team_id' => $this->team->id,
            'name' => 'Website',
            'slug' => 'website',
        ]);
        $this->column = Column::factory()->create([
            'board_id' => $this->board->id,
            'name' => 'In Progress',
        ]);
    }

    private function addMember(Team $team, User $user, string $role = 'member'): void
    {
        TeamMember::create([
            'team_id' => $team->id,
            'user_id' => $user->id,
            'role' => $role,
        ]);
    }

    private function makeTask(array $attributes = [], ?Board $board = null, ?Column $column = null): Task
    {
        $board ??= $this->board;
        $column ??= $board->is($this->board)
            ? $this->column
            : Column::factory()->create(['board_id' => $board->id]);

        return Task::factory()->create([
            'board_id' => $board->id,
            'column_id' => $column->id,
            'created_by' => $this->user->id,
            ...$attributes,
        ]);
    }

    private function search(string $q)
    {
        return $this->actingAs($this->user)->getJson(route('search', ['q' => $q]));
    }

    public function test_guests_are_rejected(): void
    {
        $this->getJson(route('search', ['q' => 'login']))->assertUnauthorized();
    }

    public function test_route_is_rate_limited(): void
    {
        $this->assertContains(
            'throttle:60,1',
            Route::getRoutes()->getByName('search')->gatherMiddleware(),
        );
    }

    public function test_returns_matching_tasks_with_navigation_fields(): void
    {
        $task = $this->makeTask(['title' => 'Fix login redirect', 'task_number' => 7]);
        $this->makeTask(['title' => 'Unrelated work']);

        $this->search('login')
            ->assertOk()
            ->assertJsonCount(1, 'tasks')
            ->assertExactJson([
                'tasks' => [[
                    'id' => $task->id,
                    'task_number' => 7,
                    'title' => 'Fix login redirect',
                    'slug' => '7-fix-login-redirect',
                    'completed_at' => null,
                    'board' => ['name' => 'Website', 'slug' => 'website'],
                    'team' => ['name' => 'Engineering', 'slug' => 'engineering'],
                    'column' => ['name' => 'In Progress'],
                ]],
            ]);
    }

    public function test_title_match_is_case_insensitive(): void
    {
        $task = $this->makeTask(['title' => 'Fix Login Redirect']);

        $this->search('LOGIN rEdIrEcT')
            ->assertOk()
            ->assertJsonPath('tasks.0.id', $task->id);
    }

    public function test_like_wildcards_in_query_are_matched_literally(): void
    {
        $this->makeTask(['title' => 'Plain task']);
        $percent = $this->makeTask(['title' => 'Raise coverage to 80%']);

        $this->search('%')
            ->assertOk()
            ->assertJsonCount(1, 'tasks')
            ->assertJsonPath('tasks.0.id', $percent->id);

        $this->search('_')->assertOk()->assertJsonCount(0, 'tasks');
    }

    public function test_tasks_from_other_teams_are_never_returned(): void
    {
        $mine = $this->makeTask(['title' => 'Shared keyword']);

        $otherTeam = Team::factory()->create();
        $this->addMember($otherTeam, User::factory()->create(), 'owner');
        $otherBoard = Board::factory()->create(['team_id' => $otherTeam->id]);
        $this->makeTask(['title' => 'Shared keyword', 'task_number' => 1], $otherBoard);

        $this->search('keyword')
            ->assertOk()
            ->assertJsonCount(1, 'tasks')
            ->assertJsonPath('tasks.0.id', $mine->id);

        // A number-only search must not leak other teams' tasks either.
        $this->search('1')
            ->assertOk()
            ->assertJsonMissing(['team' => ['name' => $otherTeam->name, 'slug' => $otherTeam->slug]]);
    }

    public function test_tasks_on_archived_boards_are_excluded(): void
    {
        $archived = Board::factory()->create(['team_id' => $this->team->id, 'is_archived' => true]);
        $this->makeTask(['title' => 'Archived keyword'], $archived);
        $active = $this->makeTask(['title' => 'Active keyword']);

        $this->search('keyword')
            ->assertOk()
            ->assertJsonCount(1, 'tasks')
            ->assertJsonPath('tasks.0.id', $active->id);
    }

    public function test_matches_task_number_with_or_without_hash(): void
    {
        $twelve = $this->makeTask(['title' => 'Numbered task', 'task_number' => 12]);
        $this->makeTask(['title' => 'Something else', 'task_number' => 13]);

        foreach (['12', '#12'] as $q) {
            $this->search($q)
                ->assertOk()
                ->assertJsonCount(1, 'tasks')
                ->assertJsonPath('tasks.0.id', $twelve->id);
        }
    }

    public function test_exact_task_number_ranks_before_title_matches(): void
    {
        $titleMatch = $this->makeTask([
            'title' => 'Plan Q12 roadmap',
            'task_number' => 40,
            'updated_at' => now(),
        ]);
        $numberMatch = $this->makeTask([
            'title' => 'Older task',
            'task_number' => 12,
            'updated_at' => now()->subWeek(),
        ]);

        $this->search('12')
            ->assertOk()
            ->assertJsonPath('tasks.0.id', $numberMatch->id)
            ->assertJsonPath('tasks.1.id', $titleMatch->id);
    }

    public function test_orders_open_tasks_first_then_most_recently_updated(): void
    {
        $completedRecent = $this->makeTask([
            'title' => 'Alpha done',
            'completed_at' => now(),
            'updated_at' => now(),
        ]);
        $openOld = $this->makeTask(['title' => 'Alpha old', 'updated_at' => now()->subDays(3)]);
        $openNew = $this->makeTask(['title' => 'Alpha new', 'updated_at' => now()->subDay()]);

        $response = $this->search('alpha')->assertOk();

        $this->assertSame(
            [$openNew->id, $openOld->id, $completedRecent->id],
            array_column($response->json('tasks'), 'id'),
        );
        $this->assertNotNull($response->json('tasks.2.completed_at'));
    }

    public function test_results_are_limited_to_ten(): void
    {
        for ($i = 1; $i <= 12; $i++) {
            $this->makeTask(['title' => "Bulk task {$i}"]);
        }

        $this->search('bulk')->assertOk()->assertJsonCount(10, 'tasks');
    }

    public function test_query_count_does_not_grow_with_results(): void
    {
        $this->makeTask(['title' => 'Probe single']);

        DB::enableQueryLog();
        $this->search('probe')->assertOk()->assertJsonCount(1, 'tasks');
        $singleResultQueries = count(DB::getQueryLog());
        DB::flushQueryLog();

        // Spread nine more matches across separate teams and boards.
        for ($i = 0; $i < 9; $i++) {
            $team = Team::factory()->create();
            $this->addMember($team, $this->user);
            $board = Board::factory()->create(['team_id' => $team->id]);
            $this->makeTask(['title' => "Probe {$i}"], $board);
        }

        DB::flushQueryLog();
        $this->search('probe')->assertOk()->assertJsonCount(10, 'tasks');
        $this->assertSame($singleResultQueries, count(DB::getQueryLog()));
    }

    public function test_query_is_required(): void
    {
        $this->actingAs($this->user)
            ->getJson(route('search'))
            ->assertUnprocessable()
            ->assertJsonValidationErrors('q');

        $this->search('   ')
            ->assertUnprocessable()
            ->assertJsonValidationErrors('q');
    }

    public function test_query_is_limited_to_one_hundred_characters(): void
    {
        $this->search(str_repeat('a', 101))
            ->assertUnprocessable()
            ->assertJsonValidationErrors('q');

        $this->search(str_repeat('a', 100))->assertOk();
    }

    public function test_query_must_be_a_string(): void
    {
        $this->actingAs($this->user)
            ->getJson(route('search').'?q[]=one')
            ->assertUnprocessable()
            ->assertJsonValidationErrors('q');
    }
}
