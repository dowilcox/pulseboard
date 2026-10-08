<?php

namespace Tests\Feature;

use App\Models\Board;
use App\Models\Column;
use App\Models\Task;
use App\Models\Team;
use App\Models\TeamMember;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * The task page autosaves with a JSON `fetch` (redirect: "manual") rather
 * than an Inertia visit, so it survives navigation and page unload. It
 * relies on: success → redirect, validation failure → 422 JSON.
 */
class TaskAutosaveRequestTest extends TestCase
{
    use RefreshDatabase;

    private User $user;

    private Team $team;

    private Board $board;

    private Task $task;

    protected function setUp(): void
    {
        parent::setUp();

        $this->user = User::factory()->create();
        $this->team = Team::factory()->create();
        TeamMember::create([
            'team_id' => $this->team->id,
            'user_id' => $this->user->id,
            'role' => 'member',
        ]);
        $this->board = Board::factory()->create(['team_id' => $this->team->id]);
        $column = Column::factory()->create(['board_id' => $this->board->id]);
        $this->task = Task::factory()->create([
            'board_id' => $this->board->id,
            'column_id' => $column->id,
            'created_by' => $this->user->id,
            'title' => 'Before',
            'effort_estimate' => null,
        ]);
    }

    public function test_json_autosave_batch_updates_several_fields_and_redirects(): void
    {
        $response = $this->actingAs($this->user)->putJson(
            route('tasks.update', [$this->team, $this->board, $this->task]),
            [
                'title' => 'After',
                'due_date' => '2026-03-24',
                'effort_estimate' => 5,
                'checklists' => [
                    [
                        'id' => 'c1',
                        'title' => 'QA',
                        'items' => [
                            ['id' => 'i1', 'text' => 'Smoke test', 'completed' => true],
                        ],
                    ],
                ],
            ],
        );

        $response->assertRedirect();

        $this->task->refresh();
        $this->assertSame('After', $this->task->title);
        $this->assertSame('2026-03-24', $this->task->due_date->toDateString());
        $this->assertSame(5, $this->task->effort_estimate);
        $this->assertSame('Smoke test', $this->task->checklists[0]['items'][0]['text']);
    }

    public function test_json_autosave_returns_422_for_invalid_values(): void
    {
        $response = $this->actingAs($this->user)->putJson(
            route('tasks.update', [$this->team, $this->board, $this->task]),
            ['effort_estimate' => 1.5],
        );

        $response->assertStatus(422);
        $response->assertJsonValidationErrors('effort_estimate');
        $this->assertNull($this->task->fresh()->effort_estimate);
    }
}
