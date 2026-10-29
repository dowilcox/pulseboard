<?php

namespace Tests\Feature;

use App\Actions\Automation\ExecuteAutomationRules;
use App\Models\AutomationRule;
use App\Models\Board;
use App\Models\Column;
use App\Models\Label;
use App\Models\Task;
use App\Models\Team;
use App\Models\TeamMember;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * A task moved to another board is a move *into* the destination board: its
 * task_moved rules run with no from column (the source column belongs to a
 * different board) and the source board's rules don't run, since the task
 * has left that board.
 */
class CrossBoardMoveAutomationTest extends TestCase
{
    use RefreshDatabase;

    private User $owner;

    private Team $team;

    private Board $source;

    private Column $sourceColumn;

    private Board $destination;

    private Column $destinationColumn;

    private Column $destinationOtherColumn;

    protected function setUp(): void
    {
        parent::setUp();

        $this->owner = User::factory()->create();
        $this->team = Team::factory()->create();
        TeamMember::create(['team_id' => $this->team->id, 'user_id' => $this->owner->id, 'role' => 'owner']);

        $this->source = Board::factory()->create(['team_id' => $this->team->id]);
        $this->sourceColumn = Column::factory()->create(['board_id' => $this->source->id]);

        $this->destination = Board::factory()->create(['team_id' => $this->team->id]);
        $this->destinationColumn = Column::factory()->create(['board_id' => $this->destination->id, 'sort_order' => 0]);
        $this->destinationOtherColumn = Column::factory()->create(['board_id' => $this->destination->id, 'sort_order' => 1]);
    }

    private function labelRule(Board $board, array $triggerConfig, string $labelName): Label
    {
        $label = Label::factory()->create(['team_id' => $this->team->id, 'name' => $labelName]);

        AutomationRule::create([
            'board_id' => $board->id,
            'name' => "Label {$labelName}",
            'trigger_type' => 'task_moved',
            'trigger_config' => $triggerConfig,
            'action_type' => 'add_label',
            'action_config' => ['label_id' => $label->id],
            'is_active' => true,
        ]);

        return $label;
    }

    private function moveAcross(): Task
    {
        $task = Task::factory()->create([
            'board_id' => $this->source->id,
            'column_id' => $this->sourceColumn->id,
            'created_by' => $this->owner->id,
        ]);

        $this->actingAs($this->owner)->patch(
            route('tasks.move', [$this->team, $this->source, $task]),
            [
                'board_id' => $this->destination->id,
                'column_id' => $this->destinationColumn->id,
                'sort_order' => null,
            ],
        )->assertRedirect();

        return $task->refresh();
    }

    public function test_destination_rules_without_a_from_column_fire(): void
    {
        $any = $this->labelRule($this->destination, [], 'any move');
        $into = $this->labelRule($this->destination, ['to_column_id' => $this->destinationColumn->id], 'into column');

        $task = $this->moveAcross();

        $labels = $task->labels()->pluck('labels.id')->all();
        $this->assertContains($any->id, $labels);
        $this->assertContains($into->id, $labels);
    }

    public function test_destination_rules_scoped_to_a_from_column_or_other_to_column_do_not_fire(): void
    {
        $fromColumn = $this->labelRule($this->destination, ['from_column_id' => $this->destinationOtherColumn->id], 'from other');
        $toOther = $this->labelRule($this->destination, ['to_column_id' => $this->destinationOtherColumn->id], 'to other');

        $task = $this->moveAcross();

        $labels = $task->labels()->pluck('labels.id')->all();
        $this->assertNotContains($fromColumn->id, $labels);
        $this->assertNotContains($toOther->id, $labels);
    }

    public function test_source_board_rules_do_not_fire(): void
    {
        $any = $this->labelRule($this->source, [], 'source any');
        $fromSource = $this->labelRule($this->source, ['from_column_id' => $this->sourceColumn->id], 'source from');

        $task = $this->moveAcross();

        $labels = $task->labels()->pluck('labels.id')->all();
        $this->assertNotContains($any->id, $labels);
        $this->assertNotContains($fromSource->id, $labels);
    }

    public function test_destination_rules_see_a_null_from_column_and_the_source_board(): void
    {
        $spy = new class extends ExecuteAutomationRules
        {
            public array $calls = [];

            public function handle(Board $board, string $triggerType, array $context = []): void
            {
                $this->calls[] = [$board->id, $triggerType, $context];
            }
        };
        $this->app->instance(ExecuteAutomationRules::class, $spy);

        $this->moveAcross();

        $moves = array_values(array_filter($spy->calls, fn ($call) => $call[1] === 'task_moved'));
        $this->assertCount(1, $moves);
        [$boardId, , $context] = $moves[0];
        $this->assertSame($this->destination->id, $boardId);
        $this->assertNull($context['from_column_id']);
        $this->assertSame($this->destinationColumn->id, $context['to_column_id']);
        $this->assertSame($this->source->id, $context['from_board_id']);
    }
}
