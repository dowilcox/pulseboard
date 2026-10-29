<?php

namespace Tests\Feature\Mcp;

use App\Mcp\Servers\PulseBoardServer;
use App\Mcp\Tools\AddComment;
use App\Mcp\Tools\AddDependency;
use App\Mcp\Tools\AssignTask;
use App\Mcp\Tools\CompleteTask;
use App\Mcp\Tools\CreateTask;
use App\Mcp\Tools\DeleteTask;
use App\Mcp\Tools\MarkNotificationsRead;
use App\Mcp\Tools\MoveTask;
use App\Mcp\Tools\PulseBoardTool;
use App\Mcp\Tools\RemoveDependency;
use App\Mcp\Tools\SetTaskLabels;
use App\Mcp\Tools\UpdateChecklist;
use App\Mcp\Tools\UpdateTask;
use App\Models\Activity;
use App\Models\Board;
use App\Models\Column;
use App\Models\Comment;
use App\Models\Label;
use App\Models\Task;
use App\Models\TaskDependency;
use App\Models\Team;
use App\Models\User;
use App\Notifications\DescriptionMentionedNotification;
use App\Notifications\TaskMentionedNotification;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Str;
use Laravel\Mcp\Server\Transport\FakeTransporter;
use ReflectionClass;
use Tests\Feature\Mcp\Concerns\InteractsWithMcp;
use Tests\TestCase;

class McpWriteToolsTest extends TestCase
{
    use InteractsWithMcp;
    use RefreshDatabase;

    private Team $team;

    private Board $board;

    private Column $todo;

    private Column $doing;

    private Column $done;

    private User $user;

    private User $bob;

    protected function setUp(): void
    {
        parent::setUp();

        $this->team = Team::factory()->create(['slug' => 'acme']);
        $this->user = $this->memberOf($this->team, 'member', ['name' => 'Alice', 'email' => 'alice@example.test']);
        $this->bob = $this->memberOf($this->team, 'member', ['name' => 'Bob', 'email' => 'bob@example.test']);
        $this->board = Board::factory()->create(['team_id' => $this->team->id, 'slug' => 'roadmap']);
        $this->todo = Column::factory()->create(['board_id' => $this->board->id, 'name' => 'To Do', 'sort_order' => 0]);
        $this->doing = Column::factory()->create(['board_id' => $this->board->id, 'name' => 'Doing', 'sort_order' => 1]);
        $this->done = Column::factory()->create(['board_id' => $this->board->id, 'name' => 'Done', 'sort_order' => 2, 'is_done_column' => true]);
    }

    public function test_every_mutating_tool_requires_the_write_ability(): void
    {
        $task = $this->makeTask($this->board, $this->todo, $this->user, ['title' => 'Untouched']);

        $tools = collect((fn () => $this->tools)->call(app(PulseBoardServer::class, ['transport' => new FakeTransporter])))
            ->filter(fn (string $tool) => (new ReflectionClass($tool))->getProperty('ability')->getDefaultValue() === 'write');

        $this->assertGreaterThanOrEqual(12, $tools->count());

        foreach ($tools as $tool) {
            $this->callTool($this->user, $tool, ['task' => $task->id, 'board' => 'roadmap', 'title' => 'x'], abilities: ['read'])
                ->assertHasErrors(['"write" ability']);
        }

        $this->assertSame('Untouched', $task->fresh()->title);
        $this->assertSame(1, Task::count());
    }

    public function test_read_tools_do_not_declare_an_ability(): void
    {
        foreach (['WhoAmI', 'ListTeams', 'ListBoards', 'GetBoard', 'ListTasks', 'GetTask', 'SearchTasks', 'MyTasks', 'ListComments', 'GetBoardActivity', 'ListNotifications'] as $name) {
            $class = 'App\\Mcp\\Tools\\'.$name;
            $this->assertTrue(is_subclass_of($class, PulseBoardTool::class));
            $this->assertNull((new ReflectionClass($class))->getProperty('ability')->getDefaultValue(), $name);
        }
    }

    public function test_create_task_uses_defaults_markdown_and_relations(): void
    {
        Label::factory()->create(['team_id' => $this->team->id, 'name' => 'Bug']);
        $parent = $this->makeTask($this->board, $this->todo, $this->user, ['title' => 'Epic']);

        $payload = $this->toolJson($this->callTool($this->user, CreateTask::class, [
            'board' => 'roadmap',
            'title' => 'New thing',
            'description' => "# Heading\n\n<script>alert(1)</script>Hi <@{$this->bob->id}> <img src=x onerror=alert(1)>\n\n```html\n<b>code</b>\n```",
            'priority' => 'high',
            'due_date' => '2026-12-01',
            'assignees' => ['me', 'bob@example.test'],
            'labels' => ['bug'],
            'parent_task' => (string) $parent->task_number,
            'checklist' => ['Step one', 'Step two'],
        ]));

        $task = Task::where('title', 'New thing')->firstOrFail();

        $this->assertSame($this->todo->id, $task->column_id, 'defaults to the first column');
        $this->assertSame('high', $task->priority);
        $this->assertSame('2026-12-01', $task->due_date->toDateString());
        $this->assertSame($parent->id, $task->parent_task_id);
        $this->assertEqualsCanonicalizing([$this->user->id, $this->bob->id], $task->assignees->pluck('id')->all());
        $this->assertSame(['Bug'], $task->labels->pluck('name')->all());
        $this->assertSame(['Step one', 'Step two'], array_column($task->checklists[0]['items'], 'text'));

        // Stored as Markdown like the editor does, sanitised by the action.
        $this->assertStringStartsWith('# Heading', $task->description);
        $this->assertStringNotContainsString('<script', $task->description);
        $this->assertStringNotContainsString('onerror', $task->description);
        $this->assertStringContainsString('data-type="mention" data-id="'.$this->bob->id.'"', $task->description);
        $this->assertStringContainsString("```html\n<b>code</b>\n```", $task->description);

        $this->assertTrue(Activity::where('task_id', $task->id)->where('action', 'created')->where('user_id', $this->user->id)->exists());
        $this->assertSame($task->id, $payload['task']['id']);
        $this->assertStringContainsString('Hi @Bob', $payload['task']['description']);
    }

    public function test_create_task_validation_and_errors(): void
    {
        $this->callTool($this->user, CreateTask::class, ['board' => 'roadmap'])->assertHasErrors(['title']);
        $this->callTool($this->user, CreateTask::class, ['board' => 'roadmap', 'title' => 'x', 'column' => 'Nope'])
            ->assertHasErrors(['Available columns: "To Do", "Doing", "Done"']);
        $this->callTool($this->user, CreateTask::class, ['board' => 'roadmap', 'title' => 'x', 'assignees' => ['stranger@example.test']])
            ->assertHasErrors(['Not active members']);
        $this->callTool($this->user, CreateTask::class, ['board' => 'roadmap', 'title' => 'x', 'description' => '<@'.Str::uuid().'>'])
            ->assertHasErrors(['Cannot mention']);

        $this->todo->update(['wip_limit' => 1]);
        $this->makeTask($this->board, $this->todo, $this->user);
        $this->callTool($this->user, CreateTask::class, ['board' => 'roadmap', 'title' => 'Over the limit'])
            ->assertHasErrors(['WIP limit']);

        $this->assertDatabaseMissing('tasks', ['title' => 'x']);
        $this->assertDatabaseMissing('tasks', ['title' => 'Over the limit']);
    }

    public function test_update_task_changes_only_given_fields_and_notifies_mentions(): void
    {
        Notification::fake();
        $task = $this->makeTask($this->board, $this->todo, $this->user, ['title' => 'Old', 'priority' => 'low', 'due_date' => '2026-11-11']);

        $payload = $this->toolJson($this->callTool($this->user, UpdateTask::class, [
            'task' => 'roadmap#'.$task->task_number,
            'title' => 'New',
            'description' => "Ping <@{$this->bob->id}> <iframe src=\"https://evil\"></iframe>",
            'due_date' => null,
        ]));

        $task->refresh();
        $this->assertSame('New', $task->title);
        $this->assertSame('low', $task->priority);
        $this->assertNull($task->due_date);
        $this->assertStringNotContainsString('iframe', $task->description);
        $this->assertEqualsCanonicalizing(['title', 'description', 'due_date'], $payload['updated']);

        $activity = Activity::where('task_id', $task->id)->where('action', 'field_changed')->firstOrFail();
        $this->assertSame('New', $activity->changes['title']['to']);
        $this->assertSame($this->user->id, $activity->user_id);
        Notification::assertSentTo($this->bob, DescriptionMentionedNotification::class);

        $this->callTool($this->user, UpdateTask::class, ['task' => $task->id])->assertHasErrors(['Nothing to update']);
    }

    public function test_move_task_by_column_name_and_position(): void
    {
        $a = $this->makeTask($this->board, $this->doing, $this->user, ['title' => 'A', 'sort_order' => 1]);
        $b = $this->makeTask($this->board, $this->doing, $this->user, ['title' => 'B', 'sort_order' => 2]);
        $task = $this->makeTask($this->board, $this->todo, $this->user, ['title' => 'Mover', 'sort_order' => 1]);

        $payload = $this->toolJson($this->callTool($this->user, MoveTask::class, [
            'task' => $task->task_number,
            'board' => 'roadmap',
            'column' => 'doing',
            'position' => 2,
        ]));

        $task->refresh();
        $this->assertSame($this->doing->id, $task->column_id);
        $this->assertSame(1.5, $task->sort_order);
        $this->assertSame('Doing', $payload['task']['column']['name']);
        $this->assertSame('To Do', $payload['from']['column']);

        $moved = Activity::where('task_id', $task->id)->where('action', 'moved')->firstOrFail();
        $this->assertSame('Doing', $moved->changes['to_column']);

        $this->toolJson($this->callTool($this->user, MoveTask::class, ['task' => $task->id, 'column' => 'Doing', 'position' => 1]));
        $this->assertSame(0.0, $task->fresh()->sort_order);

        // Into a done column completes the task.
        $this->toolJson($this->callTool($this->user, MoveTask::class, ['task' => $task->id, 'column' => $this->done->id]));
        $this->assertNotNull($task->fresh()->completed_at);
        $this->assertTrue(Activity::where('task_id', $task->id)->where('action', 'completed')->exists());
    }

    public function test_cross_board_move_requires_admin(): void
    {
        $other = Board::factory()->create(['team_id' => $this->team->id, 'slug' => 'other']);
        Column::factory()->create(['board_id' => $other->id, 'name' => 'Inbox', 'sort_order' => 0]);
        $task = $this->makeTask($this->board, $this->todo, $this->user);

        $this->callTool($this->user, MoveTask::class, ['task' => $task->id, 'column' => 'Inbox', 'target_board' => 'other'])
            ->assertHasErrors(['admin or owner']);
        $this->assertSame($this->board->id, $task->fresh()->board_id);

        $admin = $this->memberOf($this->team, 'admin');
        $this->toolJson($this->callTool($admin, MoveTask::class, ['task' => $task->id, 'column' => 'Inbox', 'target_board' => 'other']));
        $this->assertSame($other->id, $task->fresh()->board_id);
    }

    public function test_complete_task_is_idempotent_and_can_reopen(): void
    {
        $task = $this->makeTask($this->board, $this->todo, $this->user);

        $first = $this->toolJson($this->callTool($this->user, CompleteTask::class, ['task' => $task->id]));
        $this->assertTrue($first['changed']);
        $this->assertTrue($first['completed']);

        $again = $this->toolJson($this->callTool($this->user, CompleteTask::class, ['task' => $task->id, 'completed' => true]));
        $this->assertFalse($again['changed']);
        $this->assertSame(1, Activity::where('task_id', $task->id)->where('action', 'completed')->count());

        $reopened = $this->toolJson($this->callTool($this->user, CompleteTask::class, ['task' => $task->id, 'completed' => false]));
        $this->assertTrue($reopened['changed']);
        $this->assertNull($task->fresh()->completed_at);
        $this->assertTrue(Activity::where('task_id', $task->id)->where('action', 'uncompleted')->exists());
    }

    public function test_assign_task_modes(): void
    {
        $task = $this->makeTask($this->board, $this->todo, $this->user);

        $this->toolJson($this->callTool($this->user, AssignTask::class, ['task' => $task->id, 'users' => ['me']]));
        $this->toolJson($this->callTool($this->user, AssignTask::class, ['task' => $task->id, 'users' => [$this->bob->id]]));
        $this->assertEqualsCanonicalizing([$this->user->id, $this->bob->id], $task->assignees()->pluck('users.id')->all());

        $this->toolJson($this->callTool($this->user, AssignTask::class, ['task' => $task->id, 'users' => ['bob@example.test'], 'mode' => 'remove']));
        $this->assertSame([$this->user->id], $task->assignees()->pluck('users.id')->all());

        $this->toolJson($this->callTool($this->user, AssignTask::class, ['task' => $task->id, 'users' => [], 'mode' => 'set']));
        $this->assertSame(0, $task->assignees()->count());
        $this->assertTrue(Activity::where('task_id', $task->id)->where('action', 'unassigned')->exists());

        $outsider = User::factory()->create();
        $this->callTool($this->user, AssignTask::class, ['task' => $task->id, 'users' => [$outsider->id]])
            ->assertHasErrors(['Not active members']);
    }

    public function test_set_task_labels_modes(): void
    {
        $bug = Label::factory()->create(['team_id' => $this->team->id, 'name' => 'Bug']);
        $feature = Label::factory()->create(['team_id' => $this->team->id, 'name' => 'Feature']);
        $foreign = Label::factory()->create(['name' => 'Foreign']);
        $task = $this->makeTask($this->board, $this->todo, $this->user);

        $this->toolJson($this->callTool($this->user, SetTaskLabels::class, ['task' => $task->id, 'labels' => ['Bug']]));
        $this->toolJson($this->callTool($this->user, SetTaskLabels::class, ['task' => $task->id, 'labels' => [$feature->id], 'mode' => 'add']));
        $this->assertEqualsCanonicalizing([$bug->id, $feature->id], $task->labels()->pluck('labels.id')->all());

        $this->toolJson($this->callTool($this->user, SetTaskLabels::class, ['task' => $task->id, 'labels' => ['bug'], 'mode' => 'remove']));
        $this->assertSame([$feature->id], $task->labels()->pluck('labels.id')->all());
        $this->assertTrue(Activity::where('task_id', $task->id)->where('action', 'labels_changed')->exists());

        $this->callTool($this->user, SetTaskLabels::class, ['task' => $task->id, 'labels' => [$foreign->id]])
            ->assertHasErrors(['Unknown labels']);
    }

    public function test_add_comment_sanitizes_and_notifies_mentions(): void
    {
        Notification::fake();
        $task = $this->makeTask($this->board, $this->todo, $this->user);

        $payload = $this->toolJson($this->callTool($this->user, AddComment::class, [
            'task' => $task->id,
            'body' => "Looks **good** <@{$this->bob->id}><script>steal()</script>",
        ]));

        $comment = Comment::where('task_id', $task->id)->firstOrFail();
        $this->assertSame($this->user->id, $comment->user_id);
        $this->assertStringContainsString('Looks **good**', $comment->body);
        $this->assertStringNotContainsString('script', $comment->body);
        $this->assertStringContainsString('data-id="'.$this->bob->id.'"', $comment->body);
        $this->assertSame('Looks **good** @Bob', $payload['comment']['body']);
        $this->assertTrue(Activity::where('task_id', $task->id)->where('action', 'commented')->exists());
        Notification::assertSentTo($this->bob, TaskMentionedNotification::class);

        $reply = $this->toolJson($this->callTool($this->user, AddComment::class, ['task' => $task->id, 'body' => 'reply', 'reply_to' => $comment->id]));
        $this->assertSame($comment->id, $reply['comment']['parent_id']);

        $this->callTool($this->user, AddComment::class, ['task' => $task->id, 'body' => 'x', 'reply_to' => (string) Str::uuid()])
            ->assertHasErrors(['not found on this task']);
    }

    public function test_dependencies(): void
    {
        $task = $this->makeTask($this->board, $this->todo, $this->user, ['title' => 'Blocked']);
        $blocker = $this->makeTask($this->board, $this->todo, $this->user, ['title' => 'Blocker']);
        $otherBoard = Board::factory()->create(['team_id' => $this->team->id, 'slug' => 'infra']);
        $remote = $this->makeTask($otherBoard, Column::factory()->create(['board_id' => $otherBoard->id]), $this->user);

        $this->toolJson($this->callTool($this->user, AddDependency::class, ['task' => $task->id, 'depends_on' => (string) $blocker->task_number]));
        $this->toolJson($this->callTool($this->user, AddDependency::class, ['task' => $task->id, 'depends_on' => 'infra#'.$remote->task_number]));
        $this->assertSame(2, TaskDependency::where('task_id', $task->id)->count());
        $this->assertTrue(Activity::where('task_id', $task->id)->where('action', 'dependency_added')->exists());

        $this->callTool($this->user, AddDependency::class, ['task' => $blocker->id, 'depends_on' => $task->id])
            ->assertHasErrors(['circular']);

        $this->toolJson($this->callTool($this->user, RemoveDependency::class, ['task' => $task->id, 'depends_on' => $blocker->id]));
        $this->assertSame(1, TaskDependency::where('task_id', $task->id)->count());

        $this->callTool($this->user, RemoveDependency::class, ['task' => $task->id, 'depends_on' => $blocker->id])
            ->assertHasErrors(['No such dependency']);

        $foreignTeam = Team::factory()->create();
        $foreignBoard = Board::factory()->create(['team_id' => $foreignTeam->id]);
        $foreign = $this->makeTask($foreignBoard, Column::factory()->create(['board_id' => $foreignBoard->id]), $this->user);
        $this->callTool($this->user, AddDependency::class, ['task' => $task->id, 'depends_on' => $foreign->id])
            ->assertHasErrors(['not found']);
    }

    public function test_update_checklist_operations(): void
    {
        $task = $this->makeTask($this->board, $this->todo, $this->user, [
            'checklists' => [['id' => 'cl-1', 'title' => 'Steps', 'items' => [
                ['id' => 'i-1', 'text' => 'Write code', 'completed' => false],
                ['id' => 'i-2', 'text' => 'Delete me', 'completed' => false],
            ]]],
        ]);

        $payload = $this->toolJson($this->callTool($this->user, UpdateChecklist::class, [
            'task' => $task->id,
            'check' => ['write code'],
            'remove' => ['i-2'],
            'add' => ['Ship it'],
        ]));

        $items = $task->fresh()->checklists[0]['items'];
        $this->assertSame(['Write code', 'Ship it'], array_column($items, 'text'));
        $this->assertTrue($items[0]['completed']);
        $this->assertFalse($items[1]['completed']);
        $this->assertSame(['completed' => 1, 'total' => 2], $payload['progress']);
        $this->assertTrue(Activity::where('task_id', $task->id)->where('action', 'field_changed')->exists());

        $this->toolJson($this->callTool($this->user, UpdateChecklist::class, ['task' => $task->id, 'add' => ['QA'], 'checklist' => 'Release']));
        $this->assertSame(['Steps', 'Release'], array_column($task->fresh()->checklists, 'title'));

        $this->callTool($this->user, UpdateChecklist::class, ['task' => $task->id, 'check' => ['missing']])
            ->assertHasErrors(['was not found']);
    }

    public function test_delete_task_requires_confirmation_and_permission(): void
    {
        $task = $this->makeTask($this->board, $this->todo, $this->bob);

        $this->callTool($this->user, DeleteTask::class, ['task' => $task->id, 'confirm' => false])
            ->assertHasErrors(['confirm=true']);
        $this->callTool($this->user, DeleteTask::class, ['task' => $task->id, 'confirm' => true])
            ->assertHasErrors(['creator or a team admin/owner']);
        $this->assertNotNull($task->fresh());

        $payload = $this->toolJson($this->callTool($this->bob, DeleteTask::class, ['task' => $task->id, 'confirm' => true]));
        $this->assertTrue($payload['deleted']);
        $this->assertNull($task->fresh());
    }

    public function test_mark_notifications_read(): void
    {
        $id = (string) Str::uuid();
        $this->user->notifications()->create(['id' => $id, 'type' => 'X', 'data' => ['message' => 'hi']]);
        $this->user->notifications()->create(['id' => (string) Str::uuid(), 'type' => 'X', 'data' => ['message' => 'other']]);

        $payload = $this->toolJson($this->callTool($this->user, MarkNotificationsRead::class, ['ids' => [$id]]));
        $this->assertSame(1, $payload['marked_read']);
        $this->assertSame(1, $payload['unread_count']);

        $all = $this->toolJson($this->callTool($this->user, MarkNotificationsRead::class, ['all' => true]));
        $this->assertSame(0, $all['unread_count']);
    }
}
