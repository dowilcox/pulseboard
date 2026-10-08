<?php

namespace Tests\Feature;

use App\Models\Board;
use App\Models\BoardTemplate;
use App\Models\Column;
use App\Models\Task;
use App\Models\Team;
use App\Models\TeamMember;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia;
use Tests\TestCase;

class BoardSettingsTest extends TestCase
{
    use RefreshDatabase;

    private User $user;

    private Team $team;

    private Board $board;

    private Column $todo;

    private Column $doing;

    private Column $done;

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
        $this->todo = Column::factory()->create(['board_id' => $this->board->id, 'name' => 'To Do', 'sort_order' => 0]);
        $this->doing = Column::factory()->create(['board_id' => $this->board->id, 'name' => 'Doing', 'sort_order' => 1]);
        $this->done = Column::factory()->create([
            'board_id' => $this->board->id,
            'name' => 'Done',
            'sort_order' => 2,
            'is_done_column' => true,
        ]);
    }

    private function task(Column $column, float $sortOrder, array $attributes = []): Task
    {
        return Task::factory()->create(array_merge([
            'board_id' => $this->board->id,
            'column_id' => $column->id,
            'sort_order' => $sortOrder,
            'created_by' => $this->user->id,
            'completed_at' => null,
        ], $attributes));
    }

    /**
     * @param  array<string, mixed>  $overrides  Keyed by column id.
     * @return array<int, array<string, mixed>>
     */
    private function payload(array $overrides = []): array
    {
        return collect([$this->todo, $this->doing, $this->done])
            ->values()
            ->map(fn (Column $column, int $index) => array_merge([
                'id' => $column->id,
                'name' => $column->name,
                'color' => $column->color,
                'wip_limit' => null,
                'is_done_column' => $column->is_done_column,
                'sort_order' => $index,
                '_destroy' => false,
            ], $overrides[$column->id] ?? []))
            ->all();
    }

    private function saveColumns(array $columns)
    {
        return $this->actingAs($this->user)
            ->from(route('teams.boards.settings', [$this->team, $this->board]))
            ->put(route('teams.boards.columns.reorder', [$this->team, $this->board]), ['columns' => $columns]);
    }

    // ── Column removal: move vs delete ─────────────────────────────────

    public function test_removing_a_column_can_move_its_tasks_to_the_end_of_another_column(): void
    {
        $existing = $this->task($this->todo, 5);
        $first = $this->task($this->doing, 1);
        $second = $this->task($this->doing, 2);
        $third = $this->task($this->doing, 3);

        $response = $this->saveColumns($this->payload([
            $this->doing->id => ['_destroy' => true, 'move_tasks_to' => $this->todo->id, 'delete_tasks' => false],
        ]));

        $response->assertRedirect(route('teams.boards.settings', [$this->team, $this->board]));
        $response->assertSessionHas('success', 'Columns saved.');
        $this->assertDatabaseMissing('columns', ['id' => $this->doing->id]);

        $moved = Task::where('column_id', $this->todo->id)->orderBy('sort_order')->pluck('id')->all();
        $this->assertSame([$existing->id, $first->id, $second->id, $third->id], $moved);
        $this->assertGreaterThan(5, (float) $first->fresh()->sort_order);
    }

    public function test_removing_a_column_without_a_target_deletes_its_tasks(): void
    {
        $task = $this->task($this->doing, 1);

        $this->saveColumns($this->payload([
            $this->doing->id => ['_destroy' => true, 'move_tasks_to' => null, 'delete_tasks' => true],
        ]))->assertSessionHasNoErrors();

        $this->assertDatabaseMissing('columns', ['id' => $this->doing->id]);
        $this->assertDatabaseMissing('tasks', ['id' => $task->id]);
    }

    public function test_moving_tasks_into_a_done_column_completes_them(): void
    {
        $task = $this->task($this->doing, 1);

        $this->saveColumns($this->payload([
            $this->doing->id => ['_destroy' => true, 'move_tasks_to' => $this->done->id],
        ]))->assertSessionHasNoErrors();

        $task->refresh();
        $this->assertSame($this->done->id, $task->column_id);
        $this->assertNotNull($task->completed_at);
    }

    public function test_move_target_cannot_be_a_column_that_is_also_being_removed(): void
    {
        $task = $this->task($this->doing, 1);

        $response = $this->saveColumns($this->payload([
            $this->doing->id => ['_destroy' => true, 'move_tasks_to' => $this->todo->id],
            $this->todo->id => ['_destroy' => true, 'delete_tasks' => true],
        ]));

        $response->assertSessionHasErrors('columns.1.move_tasks_to');
        $this->assertDatabaseHas('columns', ['id' => $this->doing->id]);
        $this->assertDatabaseHas('columns', ['id' => $this->todo->id]);
        $this->assertSame($this->doing->id, $task->fresh()->column_id);
    }

    public function test_move_target_must_belong_to_the_same_board(): void
    {
        $task = $this->task($this->doing, 1);
        $otherBoard = Board::factory()->create(['team_id' => $this->team->id]);
        $foreign = Column::factory()->create(['board_id' => $otherBoard->id]);

        $response = $this->saveColumns($this->payload([
            $this->doing->id => ['_destroy' => true, 'move_tasks_to' => $foreign->id],
        ]));

        $response->assertSessionHasErrors('columns.1.move_tasks_to');
        $this->assertDatabaseHas('columns', ['id' => $this->doing->id]);
        $this->assertSame($this->doing->id, $task->fresh()->column_id);
    }

    public function test_removing_a_column_expected_to_be_empty_refuses_to_delete_new_tasks(): void
    {
        // The page loaded the column with 0 tasks; someone added one since.
        $task = $this->task($this->doing, 1);

        $response = $this->saveColumns($this->payload([
            $this->doing->id => ['_destroy' => true, 'move_tasks_to' => null, 'delete_tasks' => false],
        ]));

        $response->assertSessionHasErrors('columns.1.delete_tasks');
        $this->assertDatabaseHas('columns', ['id' => $this->doing->id]);
        $this->assertDatabaseHas('tasks', ['id' => $task->id]);
    }

    public function test_deleting_a_single_column_with_a_target_appends_its_tasks(): void
    {
        $existing = $this->task($this->todo, 10);
        $moved = $this->task($this->doing, 1);

        $this->actingAs($this->user)
            ->delete(route('teams.boards.columns.destroy', [$this->team, $this->board, $this->doing]), [
                'target_column_id' => $this->todo->id,
            ])
            ->assertSessionHas('success');

        $this->assertSame($this->todo->id, $moved->fresh()->column_id);
        $this->assertGreaterThan((float) $existing->sort_order, (float) $moved->fresh()->sort_order);
    }

    // ── Column save idempotency ────────────────────────────────────────

    public function test_saving_columns_again_with_the_fresh_ids_does_not_duplicate_new_columns(): void
    {
        $columns = $this->payload();
        $columns[] = [
            'name' => 'Review',
            'color' => '#123456',
            'wip_limit' => null,
            'is_done_column' => false,
            'sort_order' => 3,
            '_destroy' => false,
        ];

        $this->saveColumns($columns)->assertSessionHasNoErrors();
        $this->assertSame(4, $this->board->columns()->count());

        // The settings page the redirect lands on carries the new column's id
        // and task counts, which the client adopts before the next save.
        $props = null;
        $this->actingAs($this->user)
            ->get(route('teams.boards.settings', [$this->team, $this->board]))
            ->assertInertia(function (AssertableInertia $page) use (&$props) {
                $page->component('Boards/Settings')
                    ->has('board.columns', 4)
                    ->where('board.columns.3.name', 'Review')
                    ->where('board.columns.3.tasks_count', 0)
                    ->where('can.archive', true)
                    ->where('can.delete', true)
                    ->where('can.manageTaskTemplates', true)
                    ->etc();
                $props = $page->toArray()['props'];
            });

        $second = collect($props['board']['columns'])->map(fn (array $column, int $index) => [
            'id' => $column['id'],
            'name' => $column['name'],
            'color' => $column['color'],
            'wip_limit' => $column['wip_limit'],
            'is_done_column' => $column['is_done_column'],
            'sort_order' => $index,
            '_destroy' => false,
        ])->all();

        $this->saveColumns($second)->assertSessionHasNoErrors();
        $this->assertSame(4, $this->board->columns()->count());
        $this->assertSame(1, $this->board->columns()->where('name', 'Review')->count());
    }

    // ── Board details ──────────────────────────────────────────────────

    public function test_saving_details_redirects_back_to_settings_with_a_flash(): void
    {
        $response = $this->actingAs($this->user)->put(
            route('teams.boards.update', [$this->team, $this->board]),
            ['name' => 'Renamed Board', 'description' => 'New description'],
        );

        $this->board->refresh();
        $this->assertSame('Renamed Board', $this->board->name);
        // The slug follows the name, so the redirect uses the new URL.
        $response->assertRedirect(route('teams.boards.settings', [$this->team, $this->board]));
        $response->assertSessionHas('success', 'Board details saved.');
    }

    // ── Save as board template ─────────────────────────────────────────

    public function test_save_as_template_redirects_back_with_a_flash(): void
    {
        $settings = route('teams.boards.settings', [$this->team, $this->board]);

        $response = $this->actingAs($this->user)
            ->from($settings)
            ->post(route('boards.create-template', [$this->team, $this->board]));

        $response->assertRedirect($settings);
        $response->assertSessionHas('success');

        $template = BoardTemplate::where('created_by', $this->user->id)->sole();
        $this->assertSame($this->board->name.' Template', $template->name);
        $this->assertCount(3, $template->template_data['columns']);
    }

    public function test_repeated_save_as_template_does_not_create_duplicates(): void
    {
        $settings = route('teams.boards.settings', [$this->team, $this->board]);

        $this->actingAs($this->user)->from($settings)->post(route('boards.create-template', [$this->team, $this->board]));
        $this->actingAs($this->user)->from($settings)->post(route('boards.create-template', [$this->team, $this->board]))
            ->assertSessionHas('success');

        $this->assertSame(1, BoardTemplate::where('created_by', $this->user->id)->count());

        // Changing the columns makes the next save a new snapshot.
        $this->doing->update(['name' => 'In Progress']);
        $this->actingAs($this->user)->from($settings)->post(route('boards.create-template', [$this->team, $this->board]));

        $this->assertSame(2, BoardTemplate::where('created_by', $this->user->id)->count());
    }

    // ── Permissions on the settings page ──────────────────────────────

    public function test_members_cannot_reorder_columns(): void
    {
        $member = User::factory()->create();
        TeamMember::create(['team_id' => $this->team->id, 'user_id' => $member->id, 'role' => 'member']);

        $this->actingAs($member)
            ->put(route('teams.boards.columns.reorder', [$this->team, $this->board]), ['columns' => $this->payload([
                $this->doing->id => ['_destroy' => true, 'delete_tasks' => true],
            ])])
            ->assertForbidden();

        $this->assertDatabaseHas('columns', ['id' => $this->doing->id]);
    }
}
