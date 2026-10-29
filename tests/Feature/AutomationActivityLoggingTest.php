<?php

namespace Tests\Feature;

use App\Actions\Automation\ExecuteAutomationRules;
use App\Actions\Tasks\SyncTaskLabels;
use App\Events\BoardChanged;
use App\Models\Activity;
use App\Models\AutomationRule;
use App\Models\Board;
use App\Models\Column;
use App\Models\Label;
use App\Models\Task;
use App\Models\Team;
use App\Models\TeamMember;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
use Tests\TestCase;

/**
 * Label, assignee and watcher automation actions go through the same
 * activity log as manual changes: an activity entry, a BoardChanged
 * broadcast, and (for labels) further label_added rules.
 */
class AutomationActivityLoggingTest extends TestCase
{
    use RefreshDatabase;

    private User $user;

    private User $member;

    private Team $team;

    private Board $board;

    private Task $task;

    protected function setUp(): void
    {
        parent::setUp();

        $this->user = User::factory()->create();
        $this->member = User::factory()->create();
        $this->team = Team::factory()->create();
        TeamMember::create(['team_id' => $this->team->id, 'user_id' => $this->user->id, 'role' => 'owner']);
        TeamMember::create(['team_id' => $this->team->id, 'user_id' => $this->member->id, 'role' => 'member']);
        $this->board = Board::factory()->create(['team_id' => $this->team->id]);
        $column = Column::factory()->create(['board_id' => $this->board->id]);
        $this->task = Task::factory()->create([
            'board_id' => $this->board->id,
            'column_id' => $column->id,
            'created_by' => $this->user->id,
        ]);

        $this->actingAs($this->user);
    }

    private function rule(string $trigger, string $action, array $actionConfig, array $triggerConfig = []): AutomationRule
    {
        return AutomationRule::create([
            'board_id' => $this->board->id,
            'name' => "{$trigger} -> {$action}",
            'trigger_type' => $trigger,
            'trigger_config' => $triggerConfig,
            'action_type' => $action,
            'action_config' => $actionConfig,
            'is_active' => true,
        ]);
    }

    private function runCommentAdded(): void
    {
        ExecuteAutomationRules::run($this->board, 'comment_added', ['task_id' => $this->task->id]);
    }

    private function assertLoggedAndBroadcast(string $action, array $changes): void
    {
        $activity = Activity::where('task_id', $this->task->id)->where('action', $action)->sole();
        foreach ($changes as $key => $value) {
            $this->assertEquals($value, $activity->changes[$key] ?? null, "changes.{$key}");
        }

        Event::assertDispatched(
            BoardChanged::class,
            fn (BoardChanged $event) => $event->boardId === $this->board->id && $event->action === $action,
        );
    }

    public function test_add_label_logs_activity_and_broadcasts(): void
    {
        Event::fake([BoardChanged::class]);
        $label = Label::factory()->create(['team_id' => $this->team->id, 'name' => 'Bug']);
        $this->rule('comment_added', 'add_label', ['label_id' => $label->id]);

        $this->runCommentAdded();

        $this->assertTrue($this->task->labels()->whereKey($label->id)->exists());
        $this->assertLoggedAndBroadcast('labels_changed', ['added' => ['Bug'], 'added_label_ids' => [$label->id]]);
    }

    public function test_add_label_keeps_existing_labels_and_skips_when_present(): void
    {
        $existing = Label::factory()->create(['team_id' => $this->team->id]);
        $label = Label::factory()->create(['team_id' => $this->team->id]);
        $this->task->labels()->attach([$existing->id, $label->id]);
        $this->rule('comment_added', 'add_label', ['label_id' => $label->id]);

        $this->runCommentAdded();

        $this->assertSame(2, $this->task->labels()->count());
        $this->assertSame(0, Activity::where('action', 'labels_changed')->count());
    }

    public function test_add_label_fires_label_added_rules(): void
    {
        $label = Label::factory()->create(['team_id' => $this->team->id]);
        $this->rule('comment_added', 'add_label', ['label_id' => $label->id]);
        $this->rule('label_added', 'assign_user', ['user_id' => $this->member->id], ['label_id' => $label->id]);

        $this->runCommentAdded();

        $this->assertTrue($this->task->assignees()->whereKey($this->member->id)->exists());
    }

    public function test_label_added_chains_stop_at_the_depth_limit(): void
    {
        // A -> B -> C -> D -> E, each step a label_added rule adding the next.
        $labels = collect(['A', 'B', 'C', 'D', 'E'])
            ->mapWithKeys(fn ($name) => [$name => Label::factory()->create(['team_id' => $this->team->id, 'name' => $name])]);
        foreach (['A' => 'B', 'B' => 'C', 'C' => 'D', 'D' => 'E'] as $from => $to) {
            $this->rule('label_added', 'add_label', ['label_id' => $labels[$to]->id], ['label_id' => $labels[$from]->id]);
        }

        // A manual change at depth 0; each cascade level is one deeper, and
        // the dispatcher refuses to go past 3.
        SyncTaskLabels::run($this->task, [$labels['A']->id]);

        $attached = $this->task->labels()->pluck('name')->sort()->values()->all();
        $this->assertSame(['A', 'B', 'C', 'D'], $attached);
    }

    public function test_remove_label_logs_activity_and_broadcasts(): void
    {
        Event::fake([BoardChanged::class]);
        $keep = Label::factory()->create(['team_id' => $this->team->id]);
        $label = Label::factory()->create(['team_id' => $this->team->id, 'name' => 'Stale']);
        $this->task->labels()->attach([$keep->id, $label->id]);
        $this->rule('comment_added', 'remove_label', ['label_id' => $label->id]);

        $this->runCommentAdded();

        $this->assertSame([$keep->id], $this->task->labels()->pluck('labels.id')->all());
        $this->assertLoggedAndBroadcast('labels_changed', ['removed' => ['Stale']]);
    }

    public function test_remove_label_not_on_the_task_does_nothing(): void
    {
        $label = Label::factory()->create(['team_id' => $this->team->id]);
        $this->rule('comment_added', 'remove_label', ['label_id' => $label->id]);

        $this->runCommentAdded();

        $this->assertSame(0, Activity::count());
    }

    public function test_unassign_user_logs_activity_and_broadcasts(): void
    {
        Event::fake([BoardChanged::class]);
        $deactivated = User::factory()->create(['deactivated_at' => now()]);
        TeamMember::create(['team_id' => $this->team->id, 'user_id' => $deactivated->id, 'role' => 'member']);
        foreach ([$this->member, $deactivated] as $assignee) {
            $this->task->assignees()->attach($assignee->id, ['assigned_at' => now(), 'assigned_by' => $this->user->id]);
        }
        $this->rule('comment_added', 'unassign_user', ['user_id' => $this->member->id]);

        $this->runCommentAdded();

        // Only the configured user is removed.
        $this->assertSame([$deactivated->id], $this->task->assignees()->pluck('users.id')->all());
        $this->assertLoggedAndBroadcast('unassigned', ['users' => [$this->member->name], 'user_ids' => [$this->member->id]]);
    }

    public function test_unassign_user_who_is_not_assigned_does_nothing(): void
    {
        $this->rule('comment_added', 'unassign_user', ['user_id' => $this->member->id]);

        $this->runCommentAdded();

        $this->assertSame(0, Activity::count());
    }

    public function test_add_watcher_logs_activity_and_broadcasts(): void
    {
        Event::fake([BoardChanged::class]);
        $this->rule('comment_added', 'add_watcher', ['user_id' => $this->member->id]);

        $this->runCommentAdded();
        $this->runCommentAdded();

        $this->assertTrue($this->task->watchers()->whereKey($this->member->id)->exists());
        // Logged once: the second run finds them already watching.
        $this->assertLoggedAndBroadcast('watcher_added', ['users' => [$this->member->name], 'user_ids' => [$this->member->id]]);
    }

    public function test_remove_watcher_logs_activity_and_broadcasts(): void
    {
        Event::fake([BoardChanged::class]);
        $this->task->watchers()->attach($this->member->id, ['created_at' => now()]);
        $this->rule('comment_added', 'remove_watcher', ['user_id' => $this->member->id]);

        $this->runCommentAdded();
        $this->runCommentAdded();

        $this->assertFalse($this->task->watchers()->whereKey($this->member->id)->exists());
        $this->assertLoggedAndBroadcast('watcher_removed', ['users' => [$this->member->name]]);
    }
}
