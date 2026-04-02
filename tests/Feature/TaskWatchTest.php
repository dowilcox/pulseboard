<?php

namespace Tests\Feature;

use App\Actions\Automation\ExecuteAutomationRules;
use App\Models\AutomationRule;
use App\Models\Board;
use App\Models\Column;
use App\Models\Task;
use App\Models\Team;
use App\Models\TeamMember;
use App\Models\User;
use App\Notifications\TaskCommentedNotification;
use App\Services\ActivityLogger;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class TaskWatchTest extends TestCase
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

    public function test_team_member_can_watch_task(): void
    {
        $task = Task::factory()->create([
            'board_id' => $this->board->id,
            'column_id' => $this->column->id,
            'created_by' => $this->user->id,
        ]);

        $response = $this->actingAs($this->user)->patch(
            route('tasks.toggle-watch', [$this->team, $this->board, $task])
        );

        $response->assertRedirect();
        $this->assertTrue($task->watchers()->where('users.id', $this->user->id)->exists());
    }

    public function test_team_member_can_unwatch_task(): void
    {
        $task = Task::factory()->create([
            'board_id' => $this->board->id,
            'column_id' => $this->column->id,
            'created_by' => $this->user->id,
        ]);

        $task->watchers()->attach($this->user->id, ['created_at' => now()]);

        $response = $this->actingAs($this->user)->patch(
            route('tasks.toggle-watch', [$this->team, $this->board, $task])
        );

        $response->assertRedirect();
        $this->assertFalse($task->watchers()->where('users.id', $this->user->id)->exists());
    }

    public function test_non_team_member_cannot_watch_task(): void
    {
        $outsider = User::factory()->create();

        $task = Task::factory()->create([
            'board_id' => $this->board->id,
            'column_id' => $this->column->id,
            'created_by' => $this->user->id,
        ]);

        $response = $this->actingAs($outsider)->patch(
            route('tasks.toggle-watch', [$this->team, $this->board, $task])
        );

        $response->assertForbidden();
    }

    public function test_watch_state_returned_on_task_show(): void
    {
        $task = Task::factory()->create([
            'board_id' => $this->board->id,
            'column_id' => $this->column->id,
            'created_by' => $this->user->id,
        ]);

        // Not watching
        $response = $this->actingAs($this->user)->get(
            route('tasks.show', [$this->team, $this->board, $task])
        );

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page->where('isWatching', false));

        // Now watch
        $task->watchers()->attach($this->user->id, ['created_at' => now()]);

        $response = $this->actingAs($this->user)->get(
            route('tasks.show', [$this->team, $this->board, $task])
        );

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page->where('isWatching', true));
    }

    public function test_watchers_receive_comment_notification(): void
    {
        $watcher = User::factory()->create();
        TeamMember::create([
            'team_id' => $this->team->id,
            'user_id' => $watcher->id,
            'role' => 'member',
        ]);

        $task = Task::factory()->create([
            'board_id' => $this->board->id,
            'column_id' => $this->column->id,
            'created_by' => $this->user->id,
        ]);

        $task->watchers()->attach($watcher->id, ['created_at' => now()]);

        $task->comments()->create([
            'user_id' => $this->user->id,
            'body' => 'Test comment',
        ]);

        ActivityLogger::log($task, 'commented', [], $this->user);

        $this->assertDatabaseHas('notifications', [
            'notifiable_id' => $watcher->id,
            'notifiable_type' => User::class,
        ]);
    }

    public function test_watcher_who_is_also_assignee_gets_only_one_notification(): void
    {
        $watcher = User::factory()->create();
        TeamMember::create([
            'team_id' => $this->team->id,
            'user_id' => $watcher->id,
            'role' => 'member',
        ]);

        $task = Task::factory()->create([
            'board_id' => $this->board->id,
            'column_id' => $this->column->id,
            'created_by' => $this->user->id,
        ]);

        // User is both assignee and watcher
        $task->assignees()->attach($watcher->id, [
            'assigned_at' => now(),
            'assigned_by' => $this->user->id,
        ]);
        $task->watchers()->attach($watcher->id, ['created_at' => now()]);

        $task->comments()->create([
            'user_id' => $this->user->id,
            'body' => 'Test comment',
        ]);

        ActivityLogger::log($task, 'commented', [], $this->user);

        $notificationCount = $watcher->notifications()
            ->where('type', TaskCommentedNotification::class)
            ->count();

        $this->assertEquals(1, $notificationCount);
    }

    // ---------------------------------------------------------------
    // Automation actions
    // ---------------------------------------------------------------

    public function test_automation_action_add_watcher(): void
    {
        $task = Task::factory()->create([
            'board_id' => $this->board->id,
            'column_id' => $this->column->id,
            'created_by' => $this->user->id,
        ]);

        AutomationRule::create([
            'board_id' => $this->board->id,
            'name' => 'Auto add watcher',
            'trigger_type' => 'task_created',
            'trigger_config' => [],
            'action_type' => 'add_watcher',
            'action_config' => ['user_id' => $this->user->id],
            'is_active' => true,
        ]);

        ExecuteAutomationRules::run($this->board, 'task_created', ['task_id' => $task->id]);

        $this->assertTrue($task->watchers()->where('users.id', $this->user->id)->exists());
    }

    public function test_automation_action_add_watcher_does_not_duplicate(): void
    {
        $task = Task::factory()->create([
            'board_id' => $this->board->id,
            'column_id' => $this->column->id,
            'created_by' => $this->user->id,
        ]);

        $task->watchers()->attach($this->user->id, ['created_at' => now()]);

        AutomationRule::create([
            'board_id' => $this->board->id,
            'name' => 'Auto add watcher',
            'trigger_type' => 'task_created',
            'trigger_config' => [],
            'action_type' => 'add_watcher',
            'action_config' => ['user_id' => $this->user->id],
            'is_active' => true,
        ]);

        ExecuteAutomationRules::run($this->board, 'task_created', ['task_id' => $task->id]);

        $this->assertEquals(1, $task->watchers()->where('users.id', $this->user->id)->count());
    }

    public function test_automation_action_remove_watcher(): void
    {
        $task = Task::factory()->create([
            'board_id' => $this->board->id,
            'column_id' => $this->column->id,
            'created_by' => $this->user->id,
        ]);

        $task->watchers()->attach($this->user->id, ['created_at' => now()]);

        AutomationRule::create([
            'board_id' => $this->board->id,
            'name' => 'Auto remove watcher',
            'trigger_type' => 'task_completed',
            'trigger_config' => [],
            'action_type' => 'remove_watcher',
            'action_config' => ['user_id' => $this->user->id],
            'is_active' => true,
        ]);

        ExecuteAutomationRules::run($this->board, 'task_completed', ['task_id' => $task->id]);

        $this->assertFalse($task->watchers()->where('users.id', $this->user->id)->exists());
    }
}
