<?php

namespace Tests\Feature;

use App\Models\Board;
use App\Models\Column;
use App\Models\Comment;
use App\Models\Label;
use App\Models\Task;
use App\Models\Team;
use App\Models\TeamMember;
use App\Models\User;
use App\Notifications\TaskMentionedNotification;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CommentLabelTest extends TestCase
{
    use RefreshDatabase;

    private User $user;

    private Team $team;

    private Board $board;

    private Column $column;

    private Task $task;

    protected function setUp(): void
    {
        parent::setUp();

        $this->user = User::factory()->create();
        $this->team = Team::factory()->create();
        $this->addTeamMember($this->user, $this->team, 'owner');
        $this->board = Board::factory()->create(['team_id' => $this->team->id]);
        $this->column = Column::factory()->create(['board_id' => $this->board->id]);
        $this->task = Task::factory()->create([
            'board_id' => $this->board->id,
            'column_id' => $this->column->id,
            'created_by' => $this->user->id,
        ]);
    }

    private function addTeamMember(User $user, Team $team, string $role = 'member'): void
    {
        TeamMember::create([
            'team_id' => $team->id,
            'user_id' => $user->id,
            'role' => $role,
        ]);
    }

    // ---------------------------------------------------------------
    // CommentController Tests
    // ---------------------------------------------------------------

    public function test_can_create_comment(): void
    {
        $response = $this->actingAs($this->user)->post(
            route('comments.store', [$this->team, $this->board, $this->task]),
            ['body' => 'This is a test comment']
        );

        $response->assertRedirect();
        $this->assertDatabaseHas('comments', [
            'task_id' => $this->task->id,
            'user_id' => $this->user->id,
            'body' => 'This is a test comment',
        ]);
    }

    public function test_can_update_comment(): void
    {
        $comment = Comment::factory()->create([
            'task_id' => $this->task->id,
            'user_id' => $this->user->id,
            'body' => 'Original body',
        ]);

        $response = $this->actingAs($this->user)->put(
            route('comments.update', [$this->team, $this->board, $this->task, $comment]),
            ['body' => 'Updated body']
        );

        $response->assertRedirect();
        $comment->refresh();
        $this->assertEquals('Updated body', $comment->body);
    }

    public function test_comment_route_is_scoped_to_current_task(): void
    {
        $otherTask = Task::factory()->create([
            'board_id' => $this->board->id,
            'column_id' => $this->column->id,
            'created_by' => $this->user->id,
        ]);
        $comment = Comment::factory()->create([
            'task_id' => $otherTask->id,
            'user_id' => $this->user->id,
            'body' => 'Original body',
        ]);

        $response = $this->actingAs($this->user)->put(
            route('comments.update', [$this->team, $this->board, $this->task, $comment]),
            ['body' => 'Updated body']
        );

        $response->assertNotFound();
        $comment->refresh();
        $this->assertEquals('Original body', $comment->body);
    }

    public function test_can_delete_comment(): void
    {
        $comment = Comment::factory()->create([
            'task_id' => $this->task->id,
            'user_id' => $this->user->id,
        ]);

        $response = $this->actingAs($this->user)->delete(
            route('comments.destroy', [$this->team, $this->board, $this->task, $comment])
        );

        $response->assertRedirect();
        $this->assertDatabaseMissing('comments', ['id' => $comment->id]);
    }

    public function test_comment_requires_body(): void
    {
        $response = $this->actingAs($this->user)->post(
            route('comments.store', [$this->team, $this->board, $this->task]),
            ['body' => '']
        );

        $response->assertSessionHasErrors('body');
    }

    public function test_comment_body_is_sanitized_on_create(): void
    {
        $body = 'Hello <script>alert(1)</script><img src="javascript:alert(1)" onerror="alert(1)"><a href="https://example.com/docs" target="_blank">docs</a><a href="?comment=1">thread</a><span data-type="mention" data-id="'.$this->user->id.'" data-label="'.$this->user->name.'">@'.$this->user->name.'</span>';

        $response = $this->actingAs($this->user)->post(
            route('comments.store', [$this->team, $this->board, $this->task]),
            ['body' => $body]
        );

        $response->assertRedirect();

        $comment = Comment::query()->latest()->first();
        $this->assertNotNull($comment);
        $this->assertStringNotContainsString('<script', $comment->body);
        $this->assertStringNotContainsString('javascript:alert(1)', $comment->body);
        $this->assertStringNotContainsString('onerror=', $comment->body);
        $this->assertStringContainsString('href="https://example.com/docs"', $comment->body);
        $this->assertStringContainsString('rel="noopener noreferrer"', $comment->body);
        $this->assertStringContainsString('href="?comment=1"', $comment->body);
        $this->assertStringContainsString('data-type="mention"', $comment->body);
    }

    public function test_comment_links_are_preserved_on_update(): void
    {
        $comment = Comment::factory()->create([
            'task_id' => $this->task->id,
            'user_id' => $this->user->id,
            'body' => 'Original body',
        ]);

        $response = $this->actingAs($this->user)->put(
            route('comments.update', [$this->team, $this->board, $this->task, $comment]),
            ['body' => '<a href="./replies">Replies</a> <a href="javascript:alert(1)">bad</a>']
        );

        $response->assertRedirect();

        $comment->refresh();
        $this->assertStringContainsString('href="./replies"', $comment->body);
        $this->assertStringNotContainsString('javascript:alert(1)', $comment->body);
    }

    public function test_comment_mentions_only_team_members(): void
    {
        $teammate = User::factory()->create();
        $outsider = User::factory()->create();
        $this->addTeamMember($teammate, $this->team);

        $body = sprintf(
            '<span data-type="mention" data-id="%s" data-label="%s">@%s</span> <span data-type="mention" data-id="%s" data-label="%s">@%s</span>',
            $teammate->id,
            $teammate->name,
            $teammate->name,
            $outsider->id,
            $outsider->name,
            $outsider->name,
        );

        $response = $this->actingAs($this->user)->post(
            route('comments.store', [$this->team, $this->board, $this->task]),
            ['body' => $body]
        );

        $response->assertRedirect();

        $this->assertDatabaseHas('notifications', [
            'notifiable_id' => $teammate->id,
            'type' => TaskMentionedNotification::class,
        ]);
        $this->assertDatabaseMissing('notifications', [
            'notifiable_id' => $outsider->id,
            'type' => TaskMentionedNotification::class,
        ]);
    }

    // ---------------------------------------------------------------
    // LabelController Tests
    // ---------------------------------------------------------------

    public function test_can_create_label(): void
    {
        $response = $this->actingAs($this->user)->post(
            route('labels.store', [$this->team]),
            ['name' => 'Bug', 'color' => '#ff0000']
        );

        $response->assertRedirect();
        $this->assertDatabaseHas('labels', [
            'team_id' => $this->team->id,
            'name' => 'Bug',
            'color' => '#ff0000',
        ]);
    }

    public function test_can_update_label(): void
    {
        $label = Label::factory()->create(['team_id' => $this->team->id]);

        $response = $this->actingAs($this->user)->put(
            route('labels.update', [$this->team, $label]),
            ['name' => 'Updated Label', 'color' => '#00ff00']
        );

        $response->assertRedirect();
        $label->refresh();
        $this->assertEquals('Updated Label', $label->name);
        $this->assertEquals('#00ff00', $label->color);
    }

    public function test_can_delete_label(): void
    {
        $label = Label::factory()->create(['team_id' => $this->team->id]);

        $response = $this->actingAs($this->user)->delete(
            route('labels.destroy', [$this->team, $label])
        );

        $response->assertRedirect();
        $this->assertDatabaseMissing('labels', ['id' => $label->id]);
    }

    public function test_label_requires_name(): void
    {
        $response = $this->actingAs($this->user)->post(
            route('labels.store', [$this->team]),
            ['name' => '', 'color' => '#ff0000']
        );

        $response->assertSessionHasErrors('name');
    }
}
