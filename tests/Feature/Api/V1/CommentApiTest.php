<?php

namespace Tests\Feature\Api\V1;

use App\Models\Board;
use App\Models\Column;
use App\Models\Comment;
use App\Models\Task;
use App\Models\Team;
use App\Models\TeamMember;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CommentApiTest extends TestCase
{
    use RefreshDatabase;

    private User $user;

    private Team $team;

    private Board $board;

    private Column $column;

    private Task $task;

    private string $token;

    protected function setUp(): void
    {
        parent::setUp();

        $this->user = User::factory()->create();
        $this->team = Team::factory()->create();
        TeamMember::create(['team_id' => $this->team->id, 'user_id' => $this->user->id, 'role' => 'owner']);
        $this->board = Board::factory()->create(['team_id' => $this->team->id]);
        $this->column = Column::factory()->create(['board_id' => $this->board->id]);
        $this->task = Task::factory()->create([
            'board_id' => $this->board->id,
            'column_id' => $this->column->id,
            'created_by' => $this->user->id,
        ]);
        $this->token = $this->user->createToken('test', ['read', 'write'])->plainTextToken;
    }

    private function api(): static
    {
        return $this->withHeader('Authorization', "Bearer {$this->token}");
    }

    private function commentUrl(Comment $comment): string
    {
        return "/api/v1/teams/{$this->team->id}/boards/{$this->board->id}/tasks/{$this->task->id}/comments/{$comment->id}";
    }

    private function addMember(string $role = 'member'): array
    {
        $member = User::factory()->create();
        TeamMember::create(['team_id' => $this->team->id, 'user_id' => $member->id, 'role' => $role]);
        $token = $member->createToken('member', ['read', 'write'])->plainTextToken;

        return [$member, $token];
    }

    public function test_update_own_comment(): void
    {
        $comment = Comment::factory()->create(['task_id' => $this->task->id, 'user_id' => $this->user->id]);

        $response = $this->api()->putJson($this->commentUrl($comment), ['body' => 'Updated body']);

        $response->assertOk();
        $response->assertJsonPath('data.body', 'Updated body');
        $this->assertDatabaseHas('comments', ['id' => $comment->id, 'body' => 'Updated body']);
    }

    public function test_update_requires_body(): void
    {
        $comment = Comment::factory()->create(['task_id' => $this->task->id, 'user_id' => $this->user->id]);

        $response = $this->api()->putJson($this->commentUrl($comment), []);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['body']);
    }

    public function test_cannot_update_another_users_comment(): void
    {
        [, $memberToken] = $this->addMember();
        $comment = Comment::factory()->create(['task_id' => $this->task->id, 'user_id' => $this->user->id]);

        $response = $this->withHeader('Authorization', "Bearer {$memberToken}")
            ->putJson($this->commentUrl($comment), ['body' => 'Hijacked']);

        $response->assertForbidden();
        $this->assertNotEquals('Hijacked', $comment->fresh()->body);
    }

    public function test_owner_cannot_update_another_users_comment(): void
    {
        [$member] = $this->addMember();
        $comment = Comment::factory()->create(['task_id' => $this->task->id, 'user_id' => $member->id]);

        // Even team owners may only edit their own comments (CommentPolicy::update).
        $response = $this->api()->putJson($this->commentUrl($comment), ['body' => 'Hijacked']);

        $response->assertForbidden();
    }

    public function test_delete_own_comment(): void
    {
        $comment = Comment::factory()->create(['task_id' => $this->task->id, 'user_id' => $this->user->id]);

        $response = $this->api()->deleteJson($this->commentUrl($comment));

        $response->assertNoContent();
        $this->assertDatabaseMissing('comments', ['id' => $comment->id]);
    }

    public function test_owner_can_delete_another_users_comment(): void
    {
        [$member] = $this->addMember();
        $comment = Comment::factory()->create(['task_id' => $this->task->id, 'user_id' => $member->id]);

        $response = $this->api()->deleteJson($this->commentUrl($comment));

        $response->assertNoContent();
        $this->assertDatabaseMissing('comments', ['id' => $comment->id]);
    }

    public function test_regular_member_cannot_delete_another_users_comment(): void
    {
        [, $memberToken] = $this->addMember();
        $comment = Comment::factory()->create(['task_id' => $this->task->id, 'user_id' => $this->user->id]);

        $response = $this->withHeader('Authorization', "Bearer {$memberToken}")
            ->deleteJson($this->commentUrl($comment));

        $response->assertForbidden();
        $this->assertDatabaseHas('comments', ['id' => $comment->id]);
    }

    public function test_comment_must_belong_to_route_task(): void
    {
        $otherTask = Task::factory()->create([
            'board_id' => $this->board->id,
            'column_id' => $this->column->id,
            'created_by' => $this->user->id,
        ]);
        $comment = Comment::factory()->create(['task_id' => $otherTask->id, 'user_id' => $this->user->id]);

        $response = $this->api()->putJson($this->commentUrl($comment), ['body' => 'Wrong task']);

        $response->assertNotFound();

        $response = $this->api()->deleteJson($this->commentUrl($comment));

        $response->assertNotFound();
        $this->assertDatabaseHas('comments', ['id' => $comment->id]);
    }

    public function test_update_and_delete_require_write_ability(): void
    {
        $readToken = $this->user->createToken('read-only', ['read'])->plainTextToken;
        $comment = Comment::factory()->create(['task_id' => $this->task->id, 'user_id' => $this->user->id]);

        $response = $this->withHeader('Authorization', "Bearer {$readToken}")
            ->putJson($this->commentUrl($comment), ['body' => 'Nope']);

        $response->assertForbidden();

        $response = $this->withHeader('Authorization', "Bearer {$readToken}")
            ->deleteJson($this->commentUrl($comment));

        $response->assertForbidden();
        $this->assertDatabaseHas('comments', ['id' => $comment->id]);
    }
}
