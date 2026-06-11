<?php

namespace Tests\Feature;

use App\Models\Board;
use App\Models\Column;
use App\Models\Comment;
use App\Models\Task;
use App\Models\Team;
use App\Models\TeamMember;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CommentFlatteningTest extends TestCase
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
            'role' => 'owner',
        ]);
        $this->board = Board::factory()->create(['team_id' => $this->team->id]);
        $column = Column::factory()->create(['board_id' => $this->board->id]);
        $this->task = Task::factory()->create([
            'board_id' => $this->board->id,
            'column_id' => $column->id,
            'created_by' => $this->user->id,
        ]);
    }

    public function test_reply_to_top_level_comment_keeps_parent(): void
    {
        $root = Comment::factory()->create([
            'task_id' => $this->task->id,
            'user_id' => $this->user->id,
        ]);

        $response = $this->actingAs($this->user)->post(
            route('comments.store', [$this->team, $this->board, $this->task]),
            ['body' => 'A direct reply', 'parent_id' => $root->id],
        );

        $response->assertRedirect();
        $this->assertDatabaseHas('comments', [
            'body' => 'A direct reply',
            'task_id' => $this->task->id,
            'parent_id' => $root->id,
        ]);
    }

    public function test_reply_to_a_reply_is_flattened_to_root_parent(): void
    {
        $root = Comment::factory()->create([
            'task_id' => $this->task->id,
            'user_id' => $this->user->id,
        ]);
        $reply = Comment::factory()->create([
            'task_id' => $this->task->id,
            'user_id' => $this->user->id,
            'parent_id' => $root->id,
        ]);

        $response = $this->actingAs($this->user)->post(
            route('comments.store', [$this->team, $this->board, $this->task]),
            ['body' => 'Reply to a reply', 'parent_id' => $reply->id],
        );

        $response->assertRedirect();
        $this->assertDatabaseHas('comments', [
            'body' => 'Reply to a reply',
            'task_id' => $this->task->id,
            'parent_id' => $root->id,
        ]);
    }

    public function test_parent_comment_from_another_task_is_rejected(): void
    {
        $otherTask = Task::factory()->create([
            'board_id' => $this->board->id,
            'column_id' => $this->task->column_id,
            'created_by' => $this->user->id,
        ]);
        $foreignParent = Comment::factory()->create([
            'task_id' => $otherTask->id,
            'user_id' => $this->user->id,
        ]);

        $response = $this->actingAs($this->user)->post(
            route('comments.store', [$this->team, $this->board, $this->task]),
            ['body' => 'Should fail', 'parent_id' => $foreignParent->id],
        );

        $response->assertNotFound();
        $this->assertDatabaseMissing('comments', ['body' => 'Should fail']);
    }
}
