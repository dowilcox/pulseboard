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
use App\Services\ActivityLogger;
use App\Services\TaskAutomationDispatcher;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Log;
use Tests\TestCase;

class AutomationDepthGuardTest extends TestCase
{
    use RefreshDatabase;

    private User $user;

    private Team $team;

    private Board $board;

    private Column $column;

    private Column $otherColumn;

    private Task $task;

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
        $this->column = Column::factory()->create(['board_id' => $this->board->id, 'name' => 'To Do']);
        $this->otherColumn = Column::factory()->create(['board_id' => $this->board->id, 'name' => 'In Progress']);
        $this->task = Task::factory()->create([
            'board_id' => $this->board->id,
            'column_id' => $this->column->id,
            'created_by' => $this->user->id,
        ]);

        $this->actingAs($this->user);
    }

    public function test_recursive_automation_cascade_is_halted_by_depth_guard(): void
    {
        // Two rules that form a cycle: on assigned -> move; on moved -> assign.
        AutomationRule::create([
            'board_id' => $this->board->id,
            'name' => 'Move on assign',
            'trigger_type' => 'task_assigned',
            'trigger_config' => [],
            'action_type' => 'move_to_column',
            'action_config' => ['column_id' => $this->otherColumn->id],
            'is_active' => true,
        ]);

        AutomationRule::create([
            'board_id' => $this->board->id,
            'name' => 'Assign on move',
            'trigger_type' => 'task_moved',
            'trigger_config' => [],
            'action_type' => 'assign_user',
            'action_config' => ['user_id' => $this->user->id],
            'is_active' => true,
        ]);

        // Fake ExecuteAutomationRules so the "execute" step feeds the next
        // ActivityLogger::log call, simulating a cascade driven by Actions
        // that re-enter the logger when they mutate the task.
        $task = $this->task;
        $user = $this->user;

        ExecuteAutomationRules::allowToRun()->andReturnUsing(
            function (Board $board, string $triggerType, array $context) use ($task, $user) {
                match ($triggerType) {
                    'task_assigned' => ActivityLogger::log($task, 'moved', [
                        'from_column_id' => $this->column->id,
                        'to_column_id' => $this->otherColumn->id,
                    ], $user),
                    'task_moved' => ActivityLogger::log($task, 'assigned', [
                        'user_ids' => [$user->id],
                    ], $user),
                    default => null,
                };
            }
        );

        $warnings = [];
        Log::shouldReceive('warning')
            ->andReturnUsing(function (string $message, array $context = []) use (&$warnings) {
                $warnings[] = ['message' => $message, 'context' => $context];
            });

        // Kick off the cycle. Without the guard this would recurse forever.
        ActivityLogger::log($this->task, 'assigned', [
            'user_ids' => [$this->user->id],
        ], $this->user);

        // a) The process terminated — we got here.
        $this->assertTrue(true, 'Cascade terminated without stack overflow');

        // b) The warning was logged at least once when the depth limit hit.
        $depthWarnings = array_filter(
            $warnings,
            fn ($w) => $w['message'] === 'Automation cascade depth limit reached',
        );
        $this->assertNotEmpty(
            $depthWarnings,
            'Expected a "Automation cascade depth limit reached" warning',
        );

        // c) Reported depth matches the configured maximum (3).
        $firstDepthWarning = array_values($depthWarnings)[0];
        $this->assertSame(3, $firstDepthWarning['context']['depth']);
        $this->assertSame($this->task->id, $firstDepthWarning['context']['task_id']);
    }

    public function test_automation_depth_counter_resets_between_log_calls(): void
    {
        // A single log call should not leave the depth counter incremented.
        ExecuteAutomationRules::allowToRun()->andReturnNull();

        Log::spy();

        ActivityLogger::log($this->task, 'assigned', [
            'user_ids' => [$this->user->id],
        ], $this->user);

        $this->assertSame(0, TaskAutomationDispatcher::currentDepth());
    }
}
