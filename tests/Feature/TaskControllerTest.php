<?php

namespace Tests\Feature;

use App\Models\Board;
use App\Models\Column;
use App\Models\Label;
use App\Models\Task;
use App\Models\Team;
use App\Models\TeamMember;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class TaskControllerTest extends TestCase
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
        $this->addTeamMember($this->user, $this->team, 'owner');
        $this->board = Board::factory()->create(['team_id' => $this->team->id]);
        $this->column = Column::factory()->create(['board_id' => $this->board->id]);
    }

    private function addTeamMember(User $user, Team $team, string $role = 'member'): void
    {
        TeamMember::create([
            'team_id' => $team->id,
            'user_id' => $user->id,
            'role' => $role,
        ]);
    }

    public function test_team_member_can_create_task(): void
    {
        $response = $this->actingAs($this->user)->post(
            route('tasks.store', [$this->team, $this->board, $this->column]),
            ['title' => 'My first task']
        );

        $response->assertRedirect();
        $this->assertDatabaseHas('tasks', [
            'title' => 'My first task',
            'board_id' => $this->board->id,
            'column_id' => $this->column->id,
            'created_by' => $this->user->id,
            'priority' => 'none',
        ]);
    }

    public function test_create_task_with_full_data(): void
    {
        $label = Label::factory()->create(['team_id' => $this->team->id]);
        $assignee = User::factory()->create();
        $this->addTeamMember($assignee, $this->team);

        $response = $this->actingAs($this->user)->post(
            route('tasks.store', [$this->team, $this->board, $this->column]),
            [
                'title' => 'Detailed task',
                'description' => 'A description',
                'priority' => 'high',
                'due_date' => '2026-03-15',
                'effort_estimate' => 8,
                'assignee_ids' => [$assignee->id],
                'label_ids' => [$label->id],
            ]
        );

        $response->assertRedirect();

        $task = Task::where('title', 'Detailed task')->first();
        $this->assertNotNull($task);
        $this->assertEquals('high', $task->priority);
        $this->assertEquals(8, $task->effort_estimate);
        $this->assertTrue($task->assignees->contains($assignee));
        $this->assertTrue($task->labels->contains($label));
    }

    public function test_create_task_requires_title(): void
    {
        $response = $this->actingAs($this->user)->post(
            route('tasks.store', [$this->team, $this->board, $this->column]),
            ['title' => '']
        );

        $response->assertSessionHasErrors('title');
    }

    public function test_non_member_cannot_create_task(): void
    {
        $outsider = User::factory()->create();

        $response = $this->actingAs($outsider)->post(
            route('tasks.store', [$this->team, $this->board, $this->column]),
            ['title' => 'Sneaky task']
        );

        $response->assertForbidden();
    }

    public function test_team_member_can_update_task(): void
    {
        $task = Task::factory()->create([
            'board_id' => $this->board->id,
            'column_id' => $this->column->id,
            'created_by' => $this->user->id,
            'title' => 'Original title',
        ]);

        $response = $this->actingAs($this->user)->put(
            route('tasks.update', [$this->team, $this->board, $task]),
            ['title' => 'Updated title', 'priority' => 'urgent']
        );

        $response->assertRedirect();
        $task->refresh();
        $this->assertEquals('Updated title', $task->title);
        $this->assertEquals('urgent', $task->priority);
    }

    public function test_task_creator_can_delete_task(): void
    {
        $task = Task::factory()->create([
            'board_id' => $this->board->id,
            'column_id' => $this->column->id,
            'created_by' => $this->user->id,
        ]);

        $response = $this->actingAs($this->user)->delete(
            route('tasks.destroy', [$this->team, $this->board, $task])
        );

        $response->assertRedirect();
        $this->assertDatabaseMissing('tasks', ['id' => $task->id]);
    }

    public function test_regular_member_cannot_delete_others_task(): void
    {
        $member = User::factory()->create();
        $this->addTeamMember($member, $this->team);

        $task = Task::factory()->create([
            'board_id' => $this->board->id,
            'column_id' => $this->column->id,
            'created_by' => $this->user->id,
        ]);

        $response = $this->actingAs($member)->delete(
            route('tasks.destroy', [$this->team, $this->board, $task])
        );

        $response->assertForbidden();
    }

    public function test_admin_can_delete_any_task(): void
    {
        $admin = User::factory()->create();
        $this->addTeamMember($admin, $this->team, 'admin');

        $task = Task::factory()->create([
            'board_id' => $this->board->id,
            'column_id' => $this->column->id,
            'created_by' => $this->user->id,
        ]);

        $response = $this->actingAs($admin)->delete(
            route('tasks.destroy', [$this->team, $this->board, $task])
        );

        $response->assertRedirect();
        $this->assertDatabaseMissing('tasks', ['id' => $task->id]);
    }

    public function test_move_task_between_columns(): void
    {
        $column2 = Column::factory()->create(['board_id' => $this->board->id]);
        $task = Task::factory()->create([
            'board_id' => $this->board->id,
            'column_id' => $this->column->id,
            'created_by' => $this->user->id,
        ]);

        $response = $this->actingAs($this->user)->patch(
            route('tasks.move', [$this->team, $this->board, $task]),
            ['column_id' => $column2->id, 'sort_order' => 1.0]
        );

        $response->assertRedirect();
        $task->refresh();
        $this->assertEquals($column2->id, $task->column_id);
        $this->assertEquals(1.0, $task->sort_order);
    }

    public function test_update_task_assignees(): void
    {
        $task = Task::factory()->create([
            'board_id' => $this->board->id,
            'column_id' => $this->column->id,
            'created_by' => $this->user->id,
        ]);

        $assignee = User::factory()->create();
        $this->addTeamMember($assignee, $this->team);

        $response = $this->actingAs($this->user)->put(
            route('tasks.assignees.update', [$this->team, $this->board, $task]),
            ['user_ids' => [$assignee->id]]
        );

        $response->assertRedirect();
        $this->assertTrue($task->fresh()->assignees->contains($assignee));
    }

    public function test_update_task_labels(): void
    {
        $task = Task::factory()->create([
            'board_id' => $this->board->id,
            'column_id' => $this->column->id,
            'created_by' => $this->user->id,
        ]);

        $label = Label::factory()->create(['team_id' => $this->team->id]);

        $response = $this->actingAs($this->user)->put(
            route('tasks.labels.update', [$this->team, $this->board, $task]),
            ['label_ids' => [$label->id]]
        );

        $response->assertRedirect();
        $this->assertTrue($task->fresh()->labels->contains($label));
    }

    public function test_create_task_logs_activity(): void
    {
        $this->actingAs($this->user)->post(
            route('tasks.store', [$this->team, $this->board, $this->column]),
            ['title' => 'Tracked task']
        );

        $task = Task::where('title', 'Tracked task')->first();
        $this->assertDatabaseHas('activities', [
            'task_id' => $task->id,
            'user_id' => $this->user->id,
            'action' => 'created',
        ]);
    }

    public function test_move_task_logs_activity(): void
    {
        $column2 = Column::factory()->create(['board_id' => $this->board->id, 'name' => 'Done']);
        $task = Task::factory()->create([
            'board_id' => $this->board->id,
            'column_id' => $this->column->id,
            'created_by' => $this->user->id,
        ]);

        $this->actingAs($this->user)->patch(
            route('tasks.move', [$this->team, $this->board, $task]),
            ['column_id' => $column2->id, 'sort_order' => 1.0]
        );

        $this->assertDatabaseHas('activities', [
            'task_id' => $task->id,
            'action' => 'moved',
        ]);
    }

    public function test_sort_order_increments_for_new_tasks(): void
    {
        $this->actingAs($this->user)->post(
            route('tasks.store', [$this->team, $this->board, $this->column]),
            ['title' => 'First task']
        );

        $this->actingAs($this->user)->post(
            route('tasks.store', [$this->team, $this->board, $this->column]),
            ['title' => 'Second task']
        );

        $tasks = Task::where('column_id', $this->column->id)->orderBy('sort_order')->get();
        $this->assertCount(2, $tasks);
        $this->assertGreaterThan($tasks[0]->sort_order, $tasks[1]->sort_order);
    }
}
