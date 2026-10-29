<?php

namespace Tests\Feature;

use App\Events\BoardChanged;
use App\Models\Activity;
use App\Models\Board;
use App\Models\BoardCustomField;
use App\Models\Column;
use App\Models\Task;
use App\Models\Team;
use App\Models\TeamMember;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
use Inertia\Testing\AssertableInertia as Assert;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class CustomFieldTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    private User $member;

    private Team $team;

    private Board $board;

    private Column $column;

    protected function setUp(): void
    {
        parent::setUp();

        $this->admin = User::factory()->create();
        $this->member = User::factory()->create();
        $this->team = Team::factory()->create();
        TeamMember::create(['team_id' => $this->team->id, 'user_id' => $this->admin->id, 'role' => 'admin']);
        TeamMember::create(['team_id' => $this->team->id, 'user_id' => $this->member->id, 'role' => 'member']);
        $this->board = Board::factory()->create(['team_id' => $this->team->id]);
        $this->column = Column::factory()->create(['board_id' => $this->board->id]);
    }

    private function field(string $type = BoardCustomField::TYPE_TEXT, array $attributes = []): BoardCustomField
    {
        $factory = BoardCustomField::factory();
        $factory = BoardCustomField::typeHasOptions($type)
            ? $factory->withOptions($type)
            : $factory->ofType($type);

        return $factory->create(['board_id' => $this->board->id, ...$attributes]);
    }

    private function task(array $attributes = []): Task
    {
        return Task::factory()->create([
            'board_id' => $this->board->id,
            'column_id' => $this->column->id,
            'created_by' => $this->admin->id,
            ...$attributes,
        ]);
    }

    private function updateTask(Task $task, array $customFields, ?User $as = null)
    {
        return $this->actingAs($as ?? $this->member)->putJson(
            route('tasks.update', [$this->team, $this->board, $task]),
            ['custom_fields' => $customFields],
        );
    }

    // ── Definitions ─────────────────────────────────────────────────────

    public function test_admin_can_create_a_text_field(): void
    {
        Event::fake([BoardChanged::class]);

        $this->actingAs($this->admin)
            ->post(route('teams.boards.custom-fields.store', [$this->team, $this->board]), [
                'name' => 'Customer',
                'type' => 'text',
                'show_on_card' => true,
            ])
            ->assertRedirect()
            ->assertSessionHasNoErrors();

        $field = $this->board->customFields()->sole();
        $this->assertSame('Customer', $field->name);
        $this->assertSame('text', $field->type);
        $this->assertTrue($field->show_on_card);
        $this->assertNull($field->options);
        Event::assertDispatched(BoardChanged::class, fn ($e) => $e->action === 'custom_field.created');
    }

    public function test_select_field_gets_stable_option_ids(): void
    {
        $this->actingAs($this->admin)
            ->post(route('teams.boards.custom-fields.store', [$this->team, $this->board]), [
                'name' => 'Severity',
                'type' => 'select',
                'options' => [
                    ['label' => 'Minor', 'color' => '#22c55e'],
                    ['label' => 'Major'],
                ],
            ])
            ->assertSessionHasNoErrors();

        $options = $this->board->customFields()->sole()->options;
        $this->assertCount(2, $options);
        $this->assertSame('Minor', $options[0]['label']);
        $this->assertSame('#22c55e', $options[0]['color']);
        $this->assertNotEmpty($options[0]['id']);
        $this->assertNotSame($options[0]['id'], $options[1]['id']);
    }

    public function test_select_field_requires_options(): void
    {
        $this->actingAs($this->admin)
            ->post(route('teams.boards.custom-fields.store', [$this->team, $this->board]), [
                'name' => 'Severity',
                'type' => 'select',
            ])
            ->assertSessionHasErrors('options');
    }

    public function test_options_are_ignored_for_non_select_fields(): void
    {
        $this->actingAs($this->admin)
            ->post(route('teams.boards.custom-fields.store', [$this->team, $this->board]), [
                'name' => 'Estimate',
                'type' => 'number',
                'options' => [['label' => 'nope']],
            ])
            ->assertSessionHasNoErrors();

        $this->assertNull($this->board->customFields()->sole()->options);
    }

    public function test_field_names_are_unique_per_board(): void
    {
        $this->field(attributes: ['name' => 'Customer']);

        $this->actingAs($this->admin)
            ->post(route('teams.boards.custom-fields.store', [$this->team, $this->board]), [
                'name' => 'customer',
                'type' => 'text',
            ])
            ->assertSessionHasErrors('name');
    }

    public function test_invalid_type_is_rejected(): void
    {
        $this->actingAs($this->admin)
            ->post(route('teams.boards.custom-fields.store', [$this->team, $this->board]), [
                'name' => 'Thing',
                'type' => 'formula',
            ])
            ->assertSessionHasErrors('type');
    }

    public function test_new_fields_are_appended(): void
    {
        $this->field(attributes: ['sort_order' => 4]);

        $this->actingAs($this->admin)
            ->post(route('teams.boards.custom-fields.store', [$this->team, $this->board]), [
                'name' => 'Second',
                'type' => 'text',
            ]);

        $this->assertSame(5, $this->board->customFields()->where('name', 'Second')->sole()->sort_order);
    }

    public function test_member_cannot_manage_fields(): void
    {
        $field = $this->field();

        $this->actingAs($this->member)
            ->post(route('teams.boards.custom-fields.store', [$this->team, $this->board]), [
                'name' => 'Nope',
                'type' => 'text',
            ])
            ->assertForbidden();

        $this->actingAs($this->member)
            ->put(route('teams.boards.custom-fields.update', [$this->team, $this->board, $field]), ['name' => 'Renamed'])
            ->assertForbidden();

        $this->actingAs($this->member)
            ->put(route('teams.boards.custom-fields.reorder', [$this->team, $this->board]), ['field_ids' => [$field->id]])
            ->assertForbidden();

        $this->actingAs($this->member)
            ->delete(route('teams.boards.custom-fields.destroy', [$this->team, $this->board, $field]))
            ->assertForbidden();

        $this->assertDatabaseHas('board_custom_fields', ['id' => $field->id, 'name' => $field->name]);
    }

    public function test_non_member_cannot_manage_fields(): void
    {
        $outsider = User::factory()->create();

        $this->actingAs($outsider)
            ->post(route('teams.boards.custom-fields.store', [$this->team, $this->board]), [
                'name' => 'Nope',
                'type' => 'text',
            ])
            ->assertForbidden();
    }

    public function test_admin_can_rename_and_toggle_show_on_card(): void
    {
        $field = $this->field();

        $this->actingAs($this->admin)
            ->put(route('teams.boards.custom-fields.update', [$this->team, $this->board, $field]), [
                'name' => 'Renamed',
                'show_on_card' => true,
            ])
            ->assertSessionHasNoErrors();

        $field->refresh();
        $this->assertSame('Renamed', $field->name);
        $this->assertTrue($field->show_on_card);
    }

    public function test_field_type_cannot_change(): void
    {
        $field = $this->field();

        $this->actingAs($this->admin)
            ->put(route('teams.boards.custom-fields.update', [$this->team, $this->board, $field]), [
                'type' => 'number',
            ])
            ->assertSessionHasErrors('type');

        $this->assertSame('text', $field->fresh()->type);
    }

    public function test_field_from_another_board_is_not_found(): void
    {
        $otherBoard = Board::factory()->create(['team_id' => $this->team->id]);
        $foreign = BoardCustomField::factory()->create(['board_id' => $otherBoard->id]);

        $this->actingAs($this->admin)
            ->put(route('teams.boards.custom-fields.update', [$this->team, $this->board, $foreign]), ['name' => 'x'])
            ->assertNotFound();
    }

    public function test_relabeling_options_keeps_ids_and_values(): void
    {
        $field = $this->field(BoardCustomField::TYPE_SELECT);
        $task = $this->task(['custom_fields' => [$field->id => 'opt-2']]);

        $this->actingAs($this->admin)
            ->put(route('teams.boards.custom-fields.update', [$this->team, $this->board, $field]), [
                'options' => [
                    ['id' => 'opt-1', 'label' => 'Trivial'],
                    ['id' => 'opt-2', 'label' => 'Moderate', 'color' => '#ef4444'],
                    ['id' => 'opt-3', 'label' => 'Severe'],
                ],
            ])
            ->assertSessionHasNoErrors();

        $options = $field->fresh()->options;
        $this->assertSame(['opt-1', 'opt-2', 'opt-3'], array_column($options, 'id'));
        $this->assertSame('Moderate', $options[1]['label']);
        $this->assertSame([$field->id => 'opt-2'], $task->fresh()->custom_fields);
    }

    public function test_removing_options_clears_them_from_tasks(): void
    {
        $select = $this->field(BoardCustomField::TYPE_SELECT);
        $multi = $this->field(BoardCustomField::TYPE_MULTI_SELECT);
        $text = $this->field();

        $a = $this->task(['custom_fields' => [$select->id => 'opt-2', $multi->id => ['opt-1', 'opt-2'], $text->id => 'keep']]);
        $b = $this->task(['custom_fields' => [$select->id => 'opt-1', $multi->id => ['opt-2']]]);

        $this->actingAs($this->admin)->put(
            route('teams.boards.custom-fields.update', [$this->team, $this->board, $select]),
            ['options' => [['id' => 'opt-1', 'label' => 'Low'], ['id' => 'opt-3', 'label' => 'High']]],
        )->assertSessionHasNoErrors();

        $this->actingAs($this->admin)->put(
            route('teams.boards.custom-fields.update', [$this->team, $this->board, $multi]),
            ['options' => [['id' => 'opt-1', 'label' => 'Low']]],
        )->assertSessionHasNoErrors();

        $this->assertSame([$multi->id => ['opt-1'], $text->id => 'keep'], $a->fresh()->custom_fields);
        $this->assertSame([$select->id => 'opt-1'], $b->fresh()->custom_fields);
    }

    public function test_duplicate_option_labels_are_rejected(): void
    {
        $field = $this->field(BoardCustomField::TYPE_SELECT);

        $this->actingAs($this->admin)
            ->put(route('teams.boards.custom-fields.update', [$this->team, $this->board, $field]), [
                'options' => [['label' => 'Same'], ['label' => 'same']],
            ])
            ->assertSessionHasErrors('options.1.label');
    }

    public function test_reorder_fields(): void
    {
        $a = $this->field(attributes: ['sort_order' => 0]);
        $b = $this->field(attributes: ['sort_order' => 1]);
        $c = $this->field(attributes: ['sort_order' => 2]);

        // $b is omitted (e.g. added by someone else meanwhile): it keeps its
        // place after the listed fields.
        $this->actingAs($this->admin)
            ->put(route('teams.boards.custom-fields.reorder', [$this->team, $this->board]), [
                'field_ids' => [$c->id, $a->id],
            ])
            ->assertSessionHasNoErrors();

        $this->assertSame(
            [$c->id, $a->id, $b->id],
            $this->board->customFields()->pluck('id')->all(),
        );
    }

    public function test_reorder_rejects_fields_from_other_boards(): void
    {
        $field = $this->field();
        $foreign = BoardCustomField::factory()->create();

        $this->actingAs($this->admin)
            ->put(route('teams.boards.custom-fields.reorder', [$this->team, $this->board]), [
                'field_ids' => [$foreign->id, $field->id],
            ])
            ->assertSessionHasErrors('field_ids');
    }

    public function test_deleting_a_field_clears_its_values_from_tasks(): void
    {
        Event::fake([BoardChanged::class]);

        $doomed = $this->field();
        $kept = $this->field(BoardCustomField::TYPE_NUMBER);
        $tasks = collect(range(1, 3))->map(fn () => $this->task([
            'custom_fields' => [$doomed->id => 'gone', $kept->id => 7],
        ]));
        $onlyDoomed = $this->task(['custom_fields' => [$doomed->id => 'gone']]);

        // A task on another board with the same key is left alone.
        $otherBoard = Board::factory()->create(['team_id' => $this->team->id]);
        $otherTask = Task::factory()->create([
            'board_id' => $otherBoard->id,
            'column_id' => Column::factory()->create(['board_id' => $otherBoard->id])->id,
            'custom_fields' => [$doomed->id => 'untouched'],
        ]);

        $this->actingAs($this->admin)
            ->delete(route('teams.boards.custom-fields.destroy', [$this->team, $this->board, $doomed]))
            ->assertRedirect();

        $this->assertDatabaseMissing('board_custom_fields', ['id' => $doomed->id]);
        foreach ($tasks as $task) {
            $this->assertSame([$kept->id => 7], $task->fresh()->custom_fields);
        }
        $this->assertNull($onlyDoomed->fresh()->custom_fields);
        $this->assertSame([$doomed->id => 'untouched'], $otherTask->fresh()->custom_fields);
        Event::assertDispatched(BoardChanged::class, fn ($e) => $e->action === 'custom_field.deleted');
    }

    public function test_fields_are_deleted_with_the_board(): void
    {
        $field = $this->field();

        $this->board->delete();

        $this->assertDatabaseMissing('board_custom_fields', ['id' => $field->id]);
    }

    // ── Inertia props ───────────────────────────────────────────────────

    public function test_board_and_settings_pages_include_definitions(): void
    {
        $second = $this->field(attributes: ['name' => 'Second', 'sort_order' => 1]);
        $first = $this->field(attributes: ['name' => 'First', 'sort_order' => 0]);

        $this->actingAs($this->member)
            ->get(route('teams.boards.show', [$this->team, $this->board]))
            ->assertInertia(fn (Assert $page) => $page
                ->component('Boards/Show')
                ->where('board.custom_fields.0.id', $first->id)
                ->where('board.custom_fields.1.id', $second->id)
                ->etc());

        $this->actingAs($this->admin)
            ->get(route('teams.boards.settings', [$this->team, $this->board]))
            ->assertInertia(fn (Assert $page) => $page
                ->component('Boards/Settings')
                ->has('board.custom_fields', 2)
                ->etc());

        $task = $this->task();
        $this->actingAs($this->member)
            ->get(route('tasks.show', [$this->team, $this->board, $task]))
            ->assertInertia(fn (Assert $page) => $page
                ->component('Tasks/Show')
                ->has('board.custom_fields', 2)
                ->etc());
    }

    // ── Values ──────────────────────────────────────────────────────────

    public function test_member_can_set_valid_values_for_every_type(): void
    {
        $text = $this->field(BoardCustomField::TYPE_TEXT);
        $number = $this->field(BoardCustomField::TYPE_NUMBER);
        $date = $this->field(BoardCustomField::TYPE_DATE);
        $checkbox = $this->field(BoardCustomField::TYPE_CHECKBOX);
        $url = $this->field(BoardCustomField::TYPE_URL);
        $select = $this->field(BoardCustomField::TYPE_SELECT);
        $multi = $this->field(BoardCustomField::TYPE_MULTI_SELECT);
        $task = $this->task();

        $this->updateTask($task, [
            $text->id => '  Acme Corp  ',
            $number->id => '3.5',
            $date->id => '2026-11-02',
            $checkbox->id => true,
            $url->id => 'https://example.com/spec',
            $select->id => 'opt-3',
            // Stored in the definition's option order
            $multi->id => ['opt-3', 'opt-1'],
        ])->assertRedirect();

        $this->assertSame([
            $text->id => 'Acme Corp',
            $number->id => 3.5,
            $date->id => '2026-11-02',
            $checkbox->id => true,
            $url->id => 'https://example.com/spec',
            $select->id => 'opt-3',
            $multi->id => ['opt-1', 'opt-3'],
        ], $task->fresh()->custom_fields);
    }

    public function test_whole_numbers_are_stored_as_integers(): void
    {
        $number = $this->field(BoardCustomField::TYPE_NUMBER);
        $task = $this->task();

        $this->updateTask($task, [$number->id => '42'])->assertRedirect();

        $this->assertSame([$number->id => 42], $task->fresh()->custom_fields);
    }

    /**
     * @return array<string, array{0: string, 1: mixed}>
     */
    public static function invalidValues(): array
    {
        return [
            'text too long' => [BoardCustomField::TYPE_TEXT, str_repeat('a', 1001)],
            'text as array' => [BoardCustomField::TYPE_TEXT, ['a']],
            'number not numeric' => [BoardCustomField::TYPE_NUMBER, 'twelve'],
            'number bool' => [BoardCustomField::TYPE_NUMBER, true],
            'number huge' => [BoardCustomField::TYPE_NUMBER, 1e20],
            'date wrong format' => [BoardCustomField::TYPE_DATE, '11/02/2026'],
            'date impossible' => [BoardCustomField::TYPE_DATE, '2026-02-30'],
            'checkbox junk' => [BoardCustomField::TYPE_CHECKBOX, 'maybe'],
            'url invalid' => [BoardCustomField::TYPE_URL, 'not a url'],
            'url javascript' => [BoardCustomField::TYPE_URL, 'javascript:alert(1)'],
            'select unknown option' => [BoardCustomField::TYPE_SELECT, 'opt-99'],
            'select as array' => [BoardCustomField::TYPE_SELECT, ['opt-1']],
            'multi unknown option' => [BoardCustomField::TYPE_MULTI_SELECT, ['opt-1', 'opt-99']],
            'multi as string' => [BoardCustomField::TYPE_MULTI_SELECT, 'opt-1'],
        ];
    }

    #[DataProvider('invalidValues')]
    public function test_invalid_values_are_rejected(string $type, mixed $value): void
    {
        $field = $this->field($type);
        $task = $this->task(['custom_fields' => null]);

        $this->updateTask($task, [$field->id => $value])
            ->assertStatus(422)
            ->assertJsonValidationErrors("custom_fields.{$field->id}");

        $this->assertNull($task->fresh()->custom_fields);
    }

    public function test_unknown_keys_are_dropped(): void
    {
        $field = $this->field();
        $foreign = BoardCustomField::factory()->create();
        $task = $this->task();

        $this->updateTask($task, [
            $field->id => 'ok',
            'not-a-field' => 'x',
            $foreign->id => 'other board',
        ])->assertRedirect();

        $this->assertSame([$field->id => 'ok'], $task->fresh()->custom_fields);
    }

    public function test_partial_update_preserves_other_values(): void
    {
        $a = $this->field();
        $b = $this->field(BoardCustomField::TYPE_NUMBER);
        $task = $this->task(['custom_fields' => [$a->id => 'first', $b->id => 1]]);

        $this->updateTask($task, [$b->id => 2])->assertRedirect();

        $this->assertSame([$a->id => 'first', $b->id => 2], $task->fresh()->custom_fields);
    }

    public function test_null_and_empty_values_clear_a_field(): void
    {
        $a = $this->field();
        $b = $this->field(BoardCustomField::TYPE_CHECKBOX);
        $c = $this->field(BoardCustomField::TYPE_MULTI_SELECT);
        $task = $this->task(['custom_fields' => [$a->id => 'x', $b->id => true, $c->id => ['opt-1']]]);

        $this->updateTask($task, [$a->id => null, $b->id => false, $c->id => []])->assertRedirect();

        $this->assertNull($task->fresh()->custom_fields);
    }

    public function test_custom_fields_null_clears_every_value(): void
    {
        $a = $this->field();
        $task = $this->task(['custom_fields' => [$a->id => 'x']]);

        $this->actingAs($this->member)
            ->putJson(route('tasks.update', [$this->team, $this->board, $task]), ['custom_fields' => null])
            ->assertRedirect();

        $this->assertNull($task->fresh()->custom_fields);
    }

    public function test_other_task_fields_save_without_touching_custom_fields(): void
    {
        $a = $this->field();
        $task = $this->task(['custom_fields' => [$a->id => 'x']]);

        $this->actingAs($this->member)
            ->putJson(route('tasks.update', [$this->team, $this->board, $task]), ['title' => 'Renamed'])
            ->assertRedirect();

        $this->assertSame([$a->id => 'x'], $task->fresh()->custom_fields);
    }

    public function test_value_change_logs_only_changed_fields(): void
    {
        $a = $this->field();
        $b = $this->field();
        $task = $this->task(['custom_fields' => [$a->id => 'same', $b->id => 'old']]);

        $this->updateTask($task, [$a->id => 'same', $b->id => 'new'])->assertRedirect();

        $activity = Activity::where('task_id', $task->id)->where('action', 'field_changed')->sole();
        // assertEquals: MySQL JSON columns don't keep key order.
        $this->assertEquals([
            'from' => [$b->id => 'old'],
            'to' => [$b->id => 'new'],
        ], $activity->changes['custom_fields']);
    }

    public function test_unchanged_values_log_nothing(): void
    {
        $a = $this->field();
        $task = $this->task(['custom_fields' => [$a->id => 'same']]);

        $this->updateTask($task, [$a->id => 'same'])->assertRedirect();

        $this->assertFalse(Activity::where('task_id', $task->id)->where('action', 'field_changed')->exists());
    }

    public function test_creating_a_task_validates_custom_fields(): void
    {
        $select = $this->field(BoardCustomField::TYPE_SELECT);

        $this->actingAs($this->member)
            ->post(route('tasks.store', [$this->team, $this->board, $this->column]), [
                'title' => 'With fields',
                'custom_fields' => [$select->id => 'opt-1', 'bogus' => 'x'],
            ])
            ->assertSessionHasNoErrors();

        $this->assertSame(
            [$select->id => 'opt-1'],
            Task::where('title', 'With fields')->sole()->custom_fields,
        );

        $this->actingAs($this->member)
            ->post(route('tasks.store', [$this->team, $this->board, $this->column]), [
                'title' => 'Bad fields',
                'custom_fields' => [$select->id => 'opt-99'],
            ])
            ->assertSessionHasErrors("custom_fields.{$select->id}");

        $this->assertFalse(Task::where('title', 'Bad fields')->exists());
    }

    public function test_moving_a_task_to_another_board_clears_its_values(): void
    {
        $field = $this->field();
        $task = $this->task(['custom_fields' => [$field->id => 'x']]);
        $otherBoard = Board::factory()->create(['team_id' => $this->team->id]);
        $otherColumn = Column::factory()->create(['board_id' => $otherBoard->id]);

        $this->actingAs($this->admin)
            ->patch(route('tasks.move', [$this->team, $this->board, $task]), [
                'board_id' => $otherBoard->id,
                'column_id' => $otherColumn->id,
                'sort_order' => null,
            ])
            ->assertSessionHasNoErrors();

        $task->refresh();
        $this->assertSame($otherBoard->id, $task->board_id);
        $this->assertNull($task->custom_fields);
    }
}
