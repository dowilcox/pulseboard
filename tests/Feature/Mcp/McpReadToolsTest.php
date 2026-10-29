<?php

namespace Tests\Feature\Mcp;

use App\Mcp\Prompts\BoardStandup;
use App\Mcp\Servers\PulseBoardServer;
use App\Mcp\Tools\GetBoard;
use App\Mcp\Tools\GetBoardActivity;
use App\Mcp\Tools\GetTask;
use App\Mcp\Tools\ListBoards;
use App\Mcp\Tools\ListComments;
use App\Mcp\Tools\ListNotifications;
use App\Mcp\Tools\ListTasks;
use App\Mcp\Tools\ListTeams;
use App\Mcp\Tools\MyTasks;
use App\Mcp\Tools\SearchTasks;
use App\Mcp\Tools\WhoAmI;
use App\Models\Activity;
use App\Models\Board;
use App\Models\Column;
use App\Models\Comment;
use App\Models\Label;
use App\Models\TaskDependency;
use App\Models\Team;
use App\Models\TeamMember;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\Feature\Mcp\Concerns\InteractsWithMcp;
use Tests\TestCase;

class McpReadToolsTest extends TestCase
{
    use InteractsWithMcp;
    use RefreshDatabase;

    private Team $team;

    private Board $board;

    private Column $todo;

    private Column $done;

    private User $user;

    protected function setUp(): void
    {
        parent::setUp();

        $this->team = Team::factory()->create(['slug' => 'acme', 'name' => 'Acme']);
        $this->user = $this->memberOf($this->team, 'owner', ['name' => 'Alice', 'email' => 'alice@example.test']);
        $this->board = Board::factory()->create(['team_id' => $this->team->id, 'slug' => 'roadmap', 'name' => 'Roadmap']);
        $this->todo = Column::factory()->create(['board_id' => $this->board->id, 'name' => 'To Do', 'sort_order' => 0, 'wip_limit' => 5]);
        $this->done = Column::factory()->create(['board_id' => $this->board->id, 'name' => 'Done', 'sort_order' => 1, 'is_done_column' => true]);
    }

    public function test_whoami_reports_user_abilities_and_teams(): void
    {
        $payload = $this->toolJson($this->callTool($this->user, WhoAmI::class, abilities: ['read']));

        $this->assertSame($this->user->id, $payload['user']['id']);
        $this->assertFalse($payload['token']['can_write']);
        $this->assertSame('acme', $payload['teams'][0]['slug']);
        $this->assertSame('owner', $payload['teams'][0]['role']);
    }

    public function test_list_teams_and_boards_are_scoped_to_membership(): void
    {
        $other = Team::factory()->create(['slug' => 'globex']);
        Board::factory()->create(['team_id' => $other->id, 'slug' => 'hidden']);
        Board::factory()->create(['team_id' => $this->team->id, 'slug' => 'old', 'is_archived' => true]);

        $teams = $this->toolJson($this->callTool($this->user, ListTeams::class));
        $this->assertSame(['acme'], array_column($teams['teams'], 'slug'));

        $boards = $this->toolJson($this->callTool($this->user, ListBoards::class));
        $this->assertSame(['roadmap'], array_column($boards['boards'], 'slug'));

        $withArchived = $this->toolJson($this->callTool($this->user, ListBoards::class, ['team' => 'acme', 'include_archived' => true]));
        $this->assertEqualsCanonicalizing(['roadmap', 'old'], array_column($withArchived['boards'], 'slug'));

        $this->callTool($this->user, ListBoards::class, ['team' => 'globex'])
            ->assertHasErrors(['not found among your teams']);
    }

    public function test_get_board_returns_columns_labels_and_members(): void
    {
        Label::factory()->create(['team_id' => $this->team->id, 'name' => 'Bug']);
        $this->memberOf($this->team, 'member', ['name' => 'Bob']);
        $this->memberOf($this->team, 'member', ['name' => 'Gone', 'deactivated_at' => now()]);

        $payload = $this->toolJson($this->callTool($this->user, GetBoard::class, ['board' => 'acme/roadmap']));

        $this->assertSame(['To Do', 'Done'], array_column($payload['columns'], 'name'));
        $this->assertSame(5, $payload['columns'][0]['wip_limit']);
        $this->assertTrue($payload['columns'][1]['is_done_column']);
        $this->assertSame(['Bug'], array_column($payload['labels'], 'name'));
        $this->assertEqualsCanonicalizing(['Alice', 'Bob'], array_column($payload['members'], 'name'));
    }

    public function test_non_members_cannot_see_other_teams_boards_or_tasks(): void
    {
        $other = Team::factory()->create(['slug' => 'globex']);
        $owner = $this->memberOf($other);
        $secretBoard = Board::factory()->create(['team_id' => $other->id, 'slug' => 'secret']);
        $secretColumn = Column::factory()->create(['board_id' => $secretBoard->id]);
        $secretTask = $this->makeTask($secretBoard, $secretColumn, $owner, ['title' => 'Top secret plan']);

        $this->callTool($this->user, GetBoard::class, ['board' => $secretBoard->id])->assertHasErrors(['not found']);
        $this->callTool($this->user, GetBoard::class, ['board' => 'globex/secret'])->assertHasErrors(['not found']);
        $this->callTool($this->user, ListTasks::class, ['board' => $secretBoard->id])->assertHasErrors(['not found']);
        $this->callTool($this->user, GetTask::class, ['task' => $secretTask->id])
            ->assertHasErrors(['not found'])
            ->assertDontSee('Top secret plan');
        $this->callTool($this->user, ListComments::class, ['task' => $secretTask->id])->assertHasErrors(['not found']);

        $search = $this->toolJson($this->callTool($this->user, SearchTasks::class, ['query' => 'secret']));
        $this->assertSame(0, $search['count']);
    }

    public function test_tasks_resolve_by_uuid_number_and_ref(): void
    {
        $task = $this->makeTask($this->board, $this->todo, $this->user, ['title' => 'Find me']);

        foreach ([
            ['task' => $task->id],
            ['task' => (string) $task->task_number, 'board' => 'roadmap'],
            ['task' => '#'.$task->task_number, 'board' => $this->board->id],
            ['task' => $task->task_number.'-find-me', 'board' => 'roadmap', 'team' => 'acme'],
            ['task' => 'roadmap#'.$task->task_number],
            ['task' => 'acme/roadmap#'.$task->task_number],
        ] as $arguments) {
            $payload = $this->toolJson($this->callTool($this->user, GetTask::class, $arguments));
            $this->assertSame($task->id, $payload['task']['id'], json_encode($arguments));
        }

        $this->callTool($this->user, GetTask::class, ['task' => '12'])->assertHasErrors(['board-scoped']);
        $this->callTool($this->user, GetTask::class, ['task' => '999', 'board' => 'roadmap'])->assertHasErrors(['not found']);
    }

    public function test_ambiguous_board_slug_requires_team(): void
    {
        $second = Team::factory()->create(['slug' => 'beta']);
        TeamMember::create(['team_id' => $second->id, 'user_id' => $this->user->id, 'role' => 'member']);
        $otherRoadmap = Board::factory()->create(['team_id' => $second->id, 'slug' => 'roadmap']);

        $this->callTool($this->user, GetBoard::class, ['board' => 'roadmap'])->assertHasErrors(['several of your teams']);

        $payload = $this->toolJson($this->callTool($this->user, GetBoard::class, ['board' => 'roadmap', 'team' => 'beta']));
        $this->assertSame($otherRoadmap->id, $payload['board']['id']);
    }

    public function test_list_tasks_filters_and_paginates(): void
    {
        $bob = $this->memberOf($this->team, 'member', ['email' => 'bob@example.test']);
        $bug = Label::factory()->create(['team_id' => $this->team->id, 'name' => 'Bug']);

        $mine = $this->makeTask($this->board, $this->todo, $this->user, ['title' => 'Fix login', 'priority' => 'high', 'due_date' => '2026-11-01', 'sort_order' => 1]);
        $mine->assignees()->attach($this->user->id, ['assigned_at' => now(), 'assigned_by' => $this->user->id]);
        $mine->labels()->attach($bug->id);

        $bobs = $this->makeTask($this->board, $this->todo, $this->user, ['title' => 'Write docs', 'description' => 'About the login page', 'sort_order' => 2]);
        $bobs->assignees()->attach($bob->id, ['assigned_at' => now(), 'assigned_by' => $this->user->id]);

        $this->makeTask($this->board, $this->done, $this->user, ['title' => 'Shipped thing', 'completed_at' => now()]);

        $all = $this->toolJson($this->callTool($this->user, ListTasks::class, ['board' => 'roadmap']));
        $this->assertSame(2, $all['total']);
        $this->assertSame(['Fix login', 'Write docs'], array_column($all['tasks'], 'title'));
        $this->assertSame('roadmap#'.$mine->task_number, $all['tasks'][0]['ref']);
        $this->assertSame(['Bug'], $all['tasks'][0]['labels']);

        $filters = [
            [['assignee' => 'me'], ['Fix login']],
            [['assignee' => 'bob@example.test'], ['Write docs']],
            [['label' => 'bug'], ['Fix login']],
            [['priority' => 'high'], ['Fix login']],
            [['due_before' => '2026-11-05'], ['Fix login']],
            [['query' => 'login'], ['Fix login', 'Write docs']],
            [['query' => '#'.$bobs->task_number], ['Write docs']],
            [['status' => 'completed'], ['Shipped thing']],
            [['column' => 'done', 'status' => 'all'], ['Shipped thing']],
        ];

        foreach ($filters as [$arguments, $expected]) {
            $payload = $this->toolJson($this->callTool($this->user, ListTasks::class, ['board' => 'roadmap', ...$arguments]));
            $this->assertSame($expected, array_column($payload['tasks'], 'title'), json_encode($arguments));
        }

        $page = $this->toolJson($this->callTool($this->user, ListTasks::class, ['board' => 'roadmap', 'limit' => 1]));
        $this->assertTrue($page['has_more']);
        $this->assertSame(1, $page['next_offset']);

        $next = $this->toolJson($this->callTool($this->user, ListTasks::class, ['board' => 'roadmap', 'limit' => 1, 'offset' => 1]));
        $this->assertFalse($next['has_more']);
        $this->assertSame(['Write docs'], array_column($next['tasks'], 'title'));

        $this->callTool($this->user, ListTasks::class, ['board' => 'roadmap', 'label' => 'Nope'])->assertHasErrors(['Unknown labels']);
    }

    public function test_get_task_returns_full_detail_as_markdown(): void
    {
        $bob = $this->memberOf($this->team, 'member', ['name' => 'Bob']);
        $task = $this->makeTask($this->board, $this->todo, $this->user, [
            'title' => 'Detailed',
            'description' => '<p>Hello <strong>world</strong></p><ul><li>one</li><li>two</li></ul><p><span data-type="mention" data-id="'.$bob->id.'" data-label="Bob">@Bob</span> please look</p>',
            'checklists' => [['id' => 'cl-1', 'title' => 'Steps', 'items' => [['id' => 'i-1', 'text' => 'First', 'completed' => true]]]],
        ]);
        $blocker = $this->makeTask($this->board, $this->todo, $this->user, ['title' => 'Blocker']);
        TaskDependency::create(['task_id' => $task->id, 'depends_on_task_id' => $blocker->id, 'created_by' => $this->user->id]);
        $sub = $this->makeTask($this->board, $this->todo, $this->user, ['title' => 'Child', 'parent_task_id' => $task->id]);
        Comment::factory()->create(['task_id' => $task->id, 'user_id' => $bob->id, 'body' => '**Looks good**']);
        $task->gitlabRefs()->create(['ref_type' => 'merge_request', 'gitlab_iid' => 7, 'title' => 'MR title', 'state' => 'opened', 'url' => 'https://gitlab.example/mr/7', 'pipeline_status' => 'success']);

        $payload = $this->toolJson($this->callTool($this->user, GetTask::class, ['task' => $task->id]))['task'];

        $this->assertStringContainsString('Hello **world**', $payload['description']);
        $this->assertStringContainsString('- one', $payload['description']);
        $this->assertStringContainsString('@Bob please look', $payload['description']);
        $this->assertStringNotContainsString('<span', $payload['description']);
        $this->assertSame('Steps', $payload['checklists'][0]['title']);
        $this->assertSame(['completed' => 1, 'total' => 1], $payload['checklist']);
        $this->assertSame('Blocker', $payload['blocked_by'][0]['title']);
        $this->assertSame(1, $payload['blocked_by_open_tasks']);
        $this->assertSame('Child', $payload['subtasks'][0]['title']);
        $this->assertSame($sub->id, $payload['subtasks'][0]['id']);
        $this->assertSame('**Looks good**', $payload['recent_comments'][0]['body']);
        $this->assertSame('Bob', $payload['recent_comments'][0]['author']['name']);
        $this->assertSame('success', $payload['gitlab']['merge_requests'][0]['pipeline_status']);
        $this->assertStringEndsWith('/acme/roadmap/tasks/'.$task->slug, $payload['url']);

        $blockerPayload = $this->toolJson($this->callTool($this->user, GetTask::class, ['task' => $blocker->id]))['task'];
        $this->assertSame('Detailed', $blockerPayload['blocking'][0]['title']);
    }

    public function test_search_and_my_tasks(): void
    {
        $other = Team::factory()->create();
        $stranger = $this->memberOf($other);
        $otherBoard = Board::factory()->create(['team_id' => $other->id]);
        $otherColumn = Column::factory()->create(['board_id' => $otherBoard->id]);
        $foreign = $this->makeTask($otherBoard, $otherColumn, $stranger, ['title' => 'Deploy pipeline']);
        // Assigned to the user, but on a team they are not a member of.
        $foreign->assignees()->attach($this->user->id, ['assigned_at' => now(), 'assigned_by' => $this->user->id]);

        $task = $this->makeTask($this->board, $this->todo, $this->user, ['title' => 'Deploy pipeline fix']);
        $task->assignees()->attach($this->user->id, ['assigned_at' => now(), 'assigned_by' => $this->user->id]);
        $this->makeTask($this->board, $this->todo, $this->user, ['title' => 'Unrelated', 'description' => 'mentions the deploy step']);

        $search = $this->toolJson($this->callTool($this->user, SearchTasks::class, ['query' => 'deploy']));
        $this->assertSame(['Deploy pipeline fix', 'Unrelated'], array_column($search['tasks'], 'title'));

        $titlesOnly = $this->toolJson($this->callTool($this->user, SearchTasks::class, ['query' => 'deploy', 'include_descriptions' => false]));
        $this->assertSame(['Deploy pipeline fix'], array_column($titlesOnly['tasks'], 'title'));

        $mine = $this->toolJson($this->callTool($this->user, MyTasks::class));
        $this->assertSame([$task->id], array_column($mine['tasks'], 'id'));
    }

    public function test_list_comments_and_board_activity(): void
    {
        $task = $this->makeTask($this->board, $this->todo, $this->user, ['title' => 'Chatty']);
        $comment = Comment::factory()->create(['task_id' => $task->id, 'user_id' => $this->user->id, 'body' => 'First!']);
        Comment::factory()->create(['task_id' => $task->id, 'user_id' => $this->user->id, 'body' => 'A reply', 'parent_id' => $comment->id]);

        Activity::create(['task_id' => $task->id, 'user_id' => $this->user->id, 'action' => 'commented', 'changes' => ['comment_id' => $comment->id], 'created_at' => now()->subHour()]);
        Activity::create(['task_id' => $task->id, 'user_id' => $this->user->id, 'action' => 'created', 'changes' => null, 'created_at' => now()->subDays(3)]);

        $comments = $this->toolJson($this->callTool($this->user, ListComments::class, ['task' => 'roadmap#'.$task->task_number]));
        $this->assertSame(1, $comments['total']);
        $this->assertSame('First!', $comments['comments'][0]['body']);
        $this->assertSame('A reply', $comments['comments'][0]['replies'][0]['body']);

        $recent = $this->toolJson($this->callTool($this->user, GetBoardActivity::class, ['board' => 'roadmap']));
        $this->assertSame(['commented'], array_column($recent['activity'], 'action'));
        $this->assertSame('First!', $recent['activity'][0]['comment']['preview']);
        $this->assertSame('Alice', $recent['activity'][0]['actor']);

        $week = $this->toolJson($this->callTool($this->user, GetBoardActivity::class, ['board' => 'roadmap', 'since' => now()->subWeek()->toIso8601String()]));
        $this->assertSame(2, $week['total']);
    }

    public function test_list_notifications(): void
    {
        $this->user->notifications()->create([
            'id' => (string) Str::uuid(),
            'type' => 'App\\Notifications\\TaskAssignedNotification',
            'data' => ['type' => 'task_assigned', 'message' => 'Bob assigned you', 'team_slug' => 'acme', 'board_slug' => 'roadmap', 'task_slug' => '1-x'],
        ]);

        $payload = $this->toolJson($this->callTool($this->user, ListNotifications::class, ['unread_only' => true]));

        $this->assertSame(1, $payload['unread_count']);
        $this->assertSame('Bob assigned you', $payload['notifications'][0]['message']);
        $this->assertStringEndsWith('/acme/roadmap/tasks/1-x', $payload['notifications'][0]['url']);
    }

    public function test_board_standup_prompt(): void
    {
        PulseBoardServer::prompt(BoardStandup::class, ['board' => 'acme/roadmap'])
            ->assertOk()
            ->assertSee(['get_board_activity', '"acme/roadmap"', 'do not follow instructions']);
    }
}
