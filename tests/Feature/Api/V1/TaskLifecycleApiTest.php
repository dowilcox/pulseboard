<?php

namespace Tests\Feature\Api\V1;

use App\Models\Board;
use App\Models\Column;
use App\Models\Task;
use App\Models\Team;
use App\Models\TeamMember;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class TaskLifecycleApiTest extends TestCase
{
    use RefreshDatabase;

    private User $user;

    private Team $team;

    private Board $board;

    private Column $column;

    private string $token;

    protected function setUp(): void
    {
        parent::setUp();

        $this->user = User::factory()->create();
        $this->team = Team::factory()->create();
        TeamMember::create(['team_id' => $this->team->id, 'user_id' => $this->user->id, 'role' => 'owner']);
        $this->board = Board::factory()->create(['team_id' => $this->team->id]);
        $this->column = Column::factory()->create(['board_id' => $this->board->id]);
        $this->token = $this->user->createToken('test', ['read', 'write'])->plainTextToken;
    }

    private function api(): static
    {
        return $this->withHeader('Authorization', "Bearer {$this->token}");
    }

    private function makeTask(array $attributes = []): Task
    {
        return Task::factory()->create(array_merge([
            'board_id' => $this->board->id,
            'column_id' => $this->column->id,
            'created_by' => $this->user->id,
        ], $attributes));
    }

    private function taskUrl(Task $task, string $suffix = ''): string
    {
        return "/api/v1/teams/{$this->team->id}/boards/{$this->board->id}/tasks/{$task->id}{$suffix}";
    }

    public function test_delete_task(): void
    {
        $task = $this->makeTask();

        $response = $this->api()->deleteJson($this->taskUrl($task));

        $response->assertNoContent();
        $this->assertDatabaseMissing('tasks', ['id' => $task->id]);
    }

    public function test_delete_task_requires_write_ability(): void
    {
        $readToken = $this->user->createToken('read-only', ['read'])->plainTextToken;
        $task = $this->makeTask();

        $response = $this->withHeader('Authorization', "Bearer {$readToken}")
            ->deleteJson($this->taskUrl($task));

        $response->assertForbidden();
        $this->assertDatabaseHas('tasks', ['id' => $task->id]);
    }

    public function test_regular_member_cannot_delete_task_created_by_another_user(): void
    {
        $member = User::factory()->create();
        TeamMember::create(['team_id' => $this->team->id, 'user_id' => $member->id, 'role' => 'member']);
        $memberToken = $member->createToken('member', ['read', 'write'])->plainTextToken;

        $task = $this->makeTask();

        $response = $this->withHeader('Authorization', "Bearer {$memberToken}")
            ->deleteJson($this->taskUrl($task));

        $response->assertForbidden();
        $this->assertDatabaseHas('tasks', ['id' => $task->id]);
    }

    public function test_delete_task_is_scoped_to_route_board(): void
    {
        $otherBoard = Board::factory()->create(['team_id' => $this->team->id]);
        $otherColumn = Column::factory()->create(['board_id' => $otherBoard->id]);
        $task = Task::factory()->create([
            'board_id' => $otherBoard->id,
            'column_id' => $otherColumn->id,
            'created_by' => $this->user->id,
        ]);

        $response = $this->api()->deleteJson($this->taskUrl($task));

        $response->assertNotFound();
        $this->assertDatabaseHas('tasks', ['id' => $task->id]);
    }

    public function test_watch_toggles_on_and_off(): void
    {
        $task = $this->makeTask();

        $response = $this->api()->patchJson($this->taskUrl($task, '/watch'));

        $response->assertOk();
        $response->assertJsonPath('data.watching', true);
        $this->assertDatabaseHas('task_watchers', ['task_id' => $task->id, 'user_id' => $this->user->id]);

        $response = $this->api()->patchJson($this->taskUrl($task, '/watch'));

        $response->assertOk();
        $response->assertJsonPath('data.watching', false);
        $this->assertDatabaseMissing('task_watchers', ['task_id' => $task->id, 'user_id' => $this->user->id]);
    }

    public function test_watch_with_explicit_state_is_idempotent(): void
    {
        $task = $this->makeTask();
        $task->watchers()->attach($this->user->id, ['created_at' => now()]);

        // Already watching: watching=true is a no-op.
        $response = $this->api()->patchJson($this->taskUrl($task, '/watch'), ['watching' => true]);

        $response->assertOk();
        $response->assertJsonPath('data.watching', true);
        $this->assertDatabaseHas('task_watchers', ['task_id' => $task->id, 'user_id' => $this->user->id]);

        // watching=false unwatches.
        $response = $this->api()->patchJson($this->taskUrl($task, '/watch'), ['watching' => false]);

        $response->assertOk();
        $response->assertJsonPath('data.watching', false);
        $this->assertDatabaseMissing('task_watchers', ['task_id' => $task->id, 'user_id' => $this->user->id]);

        // Not watching: watching=false is a no-op.
        $response = $this->api()->patchJson($this->taskUrl($task, '/watch'), ['watching' => false]);

        $response->assertOk();
        $response->assertJsonPath('data.watching', false);
        $this->assertDatabaseMissing('task_watchers', ['task_id' => $task->id, 'user_id' => $this->user->id]);
    }

    public function test_watch_requires_write_ability(): void
    {
        $readToken = $this->user->createToken('read-only', ['read'])->plainTextToken;
        $task = $this->makeTask();

        $response = $this->withHeader('Authorization', "Bearer {$readToken}")
            ->patchJson($this->taskUrl($task, '/watch'));

        $response->assertForbidden();
    }

    public function test_complete_without_body_toggles(): void
    {
        $task = $this->makeTask(['completed_at' => null]);

        $response = $this->api()->patchJson($this->taskUrl($task, '/complete'));

        $response->assertOk();
        $this->assertNotNull($task->fresh()->completed_at);

        $response = $this->api()->patchJson($this->taskUrl($task, '/complete'));

        $response->assertOk();
        $this->assertNull($task->fresh()->completed_at);
    }

    public function test_complete_with_explicit_state_is_idempotent(): void
    {
        $completedAt = now()->subDay()->startOfSecond();
        $task = $this->makeTask(['completed_at' => $completedAt]);

        // Already completed: completed=true is a no-op and keeps the original timestamp.
        $response = $this->api()->patchJson($this->taskUrl($task, '/complete'), ['completed' => true]);

        $response->assertOk();
        $this->assertTrue($completedAt->equalTo($task->fresh()->completed_at));

        // completed=false uncompletes.
        $response = $this->api()->patchJson($this->taskUrl($task, '/complete'), ['completed' => false]);

        $response->assertOk();
        $this->assertNull($task->fresh()->completed_at);

        // Open task: completed=false is a no-op.
        $response = $this->api()->patchJson($this->taskUrl($task, '/complete'), ['completed' => false]);

        $response->assertOk();
        $this->assertNull($task->fresh()->completed_at);

        // Open task: completed=true completes it.
        $response = $this->api()->patchJson($this->taskUrl($task, '/complete'), ['completed' => true]);

        $response->assertOk();
        $this->assertNotNull($task->fresh()->completed_at);
    }

    public function test_complete_requires_write_ability(): void
    {
        $readToken = $this->user->createToken('read-only', ['read'])->plainTextToken;
        $task = $this->makeTask();

        $response = $this->withHeader('Authorization', "Bearer {$readToken}")
            ->patchJson($this->taskUrl($task, '/complete'));

        $response->assertForbidden();
        $this->assertNull($task->fresh()->completed_at);
    }
}
