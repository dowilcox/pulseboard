<?php

namespace Tests\Feature\Mcp;

use App\Mcp\Tools\CreateTask;
use App\Mcp\Tools\GetBoard;
use App\Mcp\Tools\GetBoardActivity;
use App\Mcp\Tools\GetTask;
use App\Mcp\Tools\ListTasks;
use App\Mcp\Tools\MyTasks;
use App\Mcp\Tools\SearchTasks;
use App\Mcp\Tools\UpdateTask;
use App\Models\Activity;
use App\Models\Board;
use App\Models\BoardCustomField;
use App\Models\Column;
use App\Models\Task;
use App\Models\Team;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Feature\Mcp\Concerns\InteractsWithMcp;
use Tests\TestCase;

class McpCustomFieldsTest extends TestCase
{
    use InteractsWithMcp;
    use RefreshDatabase;

    private Board $board;

    private Column $column;

    private User $user;

    private BoardCustomField $severity;

    private BoardCustomField $points;

    private BoardCustomField $tags;

    private BoardCustomField $signedOff;

    private BoardCustomField $customer;

    protected function setUp(): void
    {
        parent::setUp();

        $team = Team::factory()->create(['slug' => 'acme']);
        $this->user = $this->memberOf($team);
        $this->board = Board::factory()->create(['team_id' => $team->id, 'slug' => 'roadmap']);
        $this->column = Column::factory()->create(['board_id' => $this->board->id, 'sort_order' => 0]);

        $field = fn (array $attributes) => BoardCustomField::factory()->create(['board_id' => $this->board->id, ...$attributes]);

        $this->severity = $field(['name' => 'Severity', 'type' => 'select', 'sort_order' => 0, 'show_on_card' => true, 'options' => [
            ['id' => 'opt-low', 'label' => 'Low', 'color' => '#22c55e'],
            ['id' => 'opt-high', 'label' => 'High', 'color' => '#ef4444'],
        ]]);
        $this->points = $field(['name' => 'Story points', 'type' => 'number', 'sort_order' => 1]);
        $this->tags = $field(['name' => 'Tags', 'type' => 'multi_select', 'sort_order' => 2, 'options' => [
            ['id' => 'opt-api', 'label' => 'API', 'color' => '#000000'],
            ['id' => 'opt-ui', 'label' => 'UI', 'color' => '#000000'],
        ]]);
        $this->signedOff = $field(['name' => 'Signed off', 'type' => 'checkbox', 'sort_order' => 3]);
        $this->customer = $field(['name' => 'Customer', 'type' => 'text', 'sort_order' => 4]);
    }

    private function taskWith(string $title, ?array $values): Task
    {
        return $this->makeTask($this->board, $this->column, $this->user, ['title' => $title, 'custom_fields' => $values]);
    }

    public function test_get_board_includes_field_definitions(): void
    {
        $payload = $this->toolJson($this->callTool($this->user, GetBoard::class, ['board' => 'roadmap']));

        $this->assertSame(['Severity', 'Story points', 'Tags', 'Signed off', 'Customer'], array_column($payload['custom_fields'], 'name'));
        $this->assertSame($this->severity->id, $payload['custom_fields'][0]['id']);
        $this->assertSame('select', $payload['custom_fields'][0]['type']);
        $this->assertSame([['id' => 'opt-low', 'label' => 'Low'], ['id' => 'opt-high', 'label' => 'High']], $payload['custom_fields'][0]['options']);
        $this->assertArrayNotHasKey('options', $payload['custom_fields'][1]);
    }

    public function test_values_are_presented_by_name_with_option_labels(): void
    {
        $task = $this->taskWith('Checkout bug', [
            $this->severity->id => 'opt-high',
            $this->points->id => 3,
            $this->tags->id => ['opt-api', 'opt-ui'],
            $this->signedOff->id => true,
        ]);
        $task->assignees()->attach($this->user->id, ['assigned_at' => now(), 'assigned_by' => $this->user->id]);

        $expected = ['Severity' => 'High', 'Story points' => 3, 'Tags' => ['API', 'UI'], 'Signed off' => true];

        $detail = $this->toolJson($this->callTool($this->user, GetTask::class, ['task' => $task->id]));
        $this->assertSame($expected, $detail['task']['custom_fields']);

        $list = $this->toolJson($this->callTool($this->user, ListTasks::class, ['board' => 'roadmap']));
        $this->assertSame($expected, $list['tasks'][0]['custom_fields']);

        $mine = $this->toolJson($this->callTool($this->user, MyTasks::class));
        $this->assertSame($expected, $mine['tasks'][0]['custom_fields']);

        $search = $this->toolJson($this->callTool($this->user, SearchTasks::class, ['query' => 'checkout']));
        $this->assertSame($expected, $search['tasks'][0]['custom_fields']);

        // Tasks without values omit the key.
        $this->taskWith('Plain', null);
        $plain = $this->toolJson($this->callTool($this->user, ListTasks::class, ['board' => 'roadmap', 'query' => 'Plain']));
        $this->assertArrayNotHasKey('custom_fields', $plain['tasks'][0]);
    }

    public function test_create_task_resolves_names_and_labels(): void
    {
        $payload = $this->toolJson($this->callTool($this->user, CreateTask::class, [
            'board' => 'roadmap',
            'title' => 'With fields',
            'custom_fields' => [
                'severity' => 'HIGH',
                $this->points->id => 5,
                'Tags' => ['ui', 'opt-api'],
                'Signed off' => true,
                'Customer' => 'Initech',
            ],
        ]));

        $task = Task::where('title', 'With fields')->firstOrFail();
        $this->assertSame([
            $this->severity->id => 'opt-high',
            $this->points->id => 5,
            $this->tags->id => ['opt-api', 'opt-ui'],
            $this->signedOff->id => true,
            $this->customer->id => 'Initech',
        ], $task->custom_fields);
        $this->assertSame('High', $payload['task']['custom_fields']['Severity']);
    }

    public function test_presented_values_can_be_written_back(): void
    {
        $source = $this->taskWith('Source', [$this->severity->id => 'opt-low', $this->tags->id => ['opt-ui']]);
        $values = $this->toolJson($this->callTool($this->user, GetTask::class, ['task' => $source->id]))['task']['custom_fields'];

        $this->toolJson($this->callTool($this->user, CreateTask::class, ['board' => 'roadmap', 'title' => 'Copy', 'custom_fields' => $values]));

        $this->assertSame($source->fresh()->custom_fields, Task::where('title', 'Copy')->firstOrFail()->custom_fields);
    }

    public function test_update_task_merges_and_clears_values(): void
    {
        $task = $this->taskWith('Edit me', [$this->severity->id => 'opt-low', $this->points->id => 1]);

        $payload = $this->toolJson($this->callTool($this->user, UpdateTask::class, [
            'task' => $task->id,
            'custom_fields' => ['Severity' => 'high', 'Story points' => null, 'Customer' => 'Acme Corp'],
        ]));

        $this->assertSame([
            $this->severity->id => 'opt-high',
            $this->customer->id => 'Acme Corp',
        ], $task->fresh()->custom_fields);
        $this->assertSame(['Severity' => 'High', 'Customer' => 'Acme Corp'], $payload['task']['custom_fields']);
        $this->assertContains('custom_fields', $payload['updated']);

        $activity = Activity::where('task_id', $task->id)->where('action', 'field_changed')->firstOrFail();
        $this->assertSame('opt-high', $activity->changes['custom_fields']['to'][$this->severity->id]);

        $feed = $this->toolJson($this->callTool($this->user, GetBoardActivity::class, ['board' => 'roadmap']));
        $details = $feed['activity'][0]['details']['custom_fields'];
        $this->assertSame('Low', $details['from']['Severity']);
        $this->assertSame('High', $details['to']['Severity']);
    }

    public function test_update_task_never_wipes_all_values_at_once(): void
    {
        $values = [$this->severity->id => 'opt-low', $this->points->id => 3];
        $task = $this->taskWith('Keep my fields', $values);

        // custom_fields: null alongside another change is ignored.
        $this->toolJson($this->callTool($this->user, UpdateTask::class, [
            'task' => $task->id,
            'title' => 'Renamed',
            'custom_fields' => null,
        ]));
        $this->assertSame('Renamed', $task->fresh()->title);
        $this->assertEquals($values, $task->fresh()->custom_fields);

        // An empty object on its own is not an update at all.
        $this->callTool($this->user, UpdateTask::class, ['task' => $task->id, 'custom_fields' => []])
            ->assertHasErrors(['Nothing to update']);
        $this->assertEquals($values, $task->fresh()->custom_fields);
    }

    public function test_unknown_fields_and_options_are_clear_errors(): void
    {
        $task = $this->taskWith('Errors', null);

        $this->callTool($this->user, UpdateTask::class, ['task' => $task->id, 'custom_fields' => ['Priority level' => 'x']])
            ->assertHasErrors(['Unknown custom field "Priority level"', '"Severity"']);
        $this->callTool($this->user, UpdateTask::class, ['task' => $task->id, 'custom_fields' => ['Severity' => 'Critical']])
            ->assertHasErrors(['"Critical" is not an option of custom field "Severity". Options: "Low", "High"']);
        $this->callTool($this->user, CreateTask::class, ['board' => 'roadmap', 'title' => 'Bad tag', 'custom_fields' => ['Tags' => ['API', 'Nope']]])
            ->assertHasErrors(['"Nope" is not an option of custom field "Tags"']);
        $this->callTool($this->user, UpdateTask::class, ['task' => $task->id, 'custom_fields' => ['Severity' => 'Low', 'severity' => 'High']])
            ->assertHasErrors(['given more than once']);

        // Type validation is the action's (CustomFieldValues) job.
        $this->callTool($this->user, UpdateTask::class, ['task' => $task->id, 'custom_fields' => ['Story points' => 'lots']])
            ->assertHasErrors(['Story points must be a number.']);

        $this->assertNull($task->fresh()->custom_fields);
        $this->assertDatabaseMissing('tasks', ['title' => 'Bad tag']);
    }

    public function test_ambiguous_option_label_and_id(): void
    {
        $this->severity->update(['options' => [
            ['id' => 'opt-low', 'label' => 'Low', 'color' => '#000000'],
            ['id' => 'opt-high', 'label' => 'opt-low', 'color' => '#000000'],
        ]]);
        $task = $this->taskWith('Ambiguous', null);

        $this->callTool($this->user, UpdateTask::class, ['task' => $task->id, 'custom_fields' => ['Severity' => 'opt-low']])
            ->assertHasErrors(['ambiguous']);
    }

    public function test_list_tasks_custom_field_filters(): void
    {
        $this->taskWith('High API', [$this->severity->id => 'opt-high', $this->tags->id => ['opt-api'], $this->signedOff->id => true, $this->points->id => 3]);
        $this->taskWith('Low UI', [$this->severity->id => 'opt-low', $this->tags->id => ['opt-api', 'opt-ui'], $this->customer->id => 'Initech']);
        $this->taskWith('Nothing', null);

        $cases = [
            [['Severity' => 'high'], ['High API']],
            [['Severity' => ['Low', 'High']], ['High API', 'Low UI']],
            [['Severity' => null], ['Nothing']],
            [['Tags' => 'UI'], ['Low UI']],
            [['Tags' => 'api'], ['High API', 'Low UI']],
            [['Signed off' => true], ['High API']],
            [['Signed off' => false], ['Low UI', 'Nothing']],
            [['Customer' => true], ['Low UI']],
            [['Customer' => 'Initech'], ['Low UI']],
            [['Story points' => 3], ['High API']],
            [['Severity' => 'low', 'Tags' => 'API'], ['Low UI']],
        ];

        foreach ($cases as [$filter, $expected]) {
            $payload = $this->toolJson($this->callTool($this->user, ListTasks::class, ['board' => 'roadmap', 'custom_fields' => $filter, 'sort' => 'task_number']));
            $this->assertSame($expected, array_column($payload['tasks'], 'title'), json_encode($filter));
        }

        $this->callTool($this->user, ListTasks::class, ['board' => 'roadmap', 'custom_fields' => ['Nope' => true]])
            ->assertHasErrors(['Unknown custom field']);
    }
}
