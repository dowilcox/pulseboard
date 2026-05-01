<?php

namespace Tests\Feature;

use App\Models\Board;
use App\Models\Column;
use App\Models\Comment;
use App\Models\Task;
use App\Models\Team;
use App\Models\TeamMember;
use App\Models\User;
use App\Notifications\TaskCommentReplyNotification;
use App\Notifications\TaskMentionedNotification;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CommentReplyNotificationTest extends TestCase
{
    use RefreshDatabase;

    private User $replier;

    private User $parentAuthor;

    private Team $team;

    private Board $board;

    private Task $task;

    protected function setUp(): void
    {
        parent::setUp();

        $this->replier = User::factory()->create();
        $this->parentAuthor = User::factory()->create();
        $this->team = Team::factory()->create();
        $this->addTeamMember($this->replier, $this->team, 'owner');
        $this->addTeamMember($this->parentAuthor, $this->team);

        $this->board = Board::factory()->create(['team_id' => $this->team->id]);
        $column = Column::factory()->create(['board_id' => $this->board->id]);
        $this->task = Task::factory()->create([
            'board_id' => $this->board->id,
            'column_id' => $column->id,
            'created_by' => $this->replier->id,
            'title' => 'Threaded Task',
        ]);
    }

    public function test_parent_comment_author_receives_reply_notification(): void
    {
        $parent = $this->createParentComment();

        $response = $this->actingAs($this->replier)->post(
            route('comments.store', [$this->team, $this->board, $this->task]),
            [
                'body' => 'This is the reply body.',
                'parent_id' => $parent->id,
            ],
        );

        $response->assertRedirect();

        $notification = $this->parentAuthor->notifications()
            ->where('type', TaskCommentReplyNotification::class)
            ->first();

        $this->assertNotNull($notification);
        $this->assertSame('task_comment_replied', $notification->data['type']);
        $this->assertSame($parent->id, $notification->data['parent_comment_id']);
        $this->assertSame('This is the reply body.', $notification->data['comment_preview']);
        $this->assertStringContainsString(
            "{$this->replier->name} replied to your comment on \"Threaded Task\"",
            $notification->data['message'],
        );
    }

    public function test_replying_to_own_comment_does_not_send_reply_notification(): void
    {
        $parent = Comment::factory()->create([
            'task_id' => $this->task->id,
            'user_id' => $this->replier->id,
            'body' => 'Parent comment',
        ]);

        $response = $this->actingAs($this->replier)->post(
            route('comments.store', [$this->team, $this->board, $this->task]),
            [
                'body' => 'Self reply',
                'parent_id' => $parent->id,
            ],
        );

        $response->assertRedirect();

        $this->assertDatabaseMissing('notifications', [
            'notifiable_id' => $this->replier->id,
            'type' => TaskCommentReplyNotification::class,
        ]);
    }

    public function test_parent_author_mentioned_in_reply_gets_only_reply_notification(): void
    {
        $parent = $this->createParentComment();
        $body = sprintf(
            '<span data-type="mention" data-id="%s" data-label="%s">@%s</span> please review.',
            $this->parentAuthor->id,
            $this->parentAuthor->name,
            $this->parentAuthor->name,
        );

        $response = $this->actingAs($this->replier)->post(
            route('comments.store', [$this->team, $this->board, $this->task]),
            [
                'body' => $body,
                'parent_id' => $parent->id,
            ],
        );

        $response->assertRedirect();

        $this->assertSame(
            1,
            $this->parentAuthor->notifications()
                ->where('type', TaskCommentReplyNotification::class)
                ->count(),
        );
        $this->assertSame(
            0,
            $this->parentAuthor->notifications()
                ->where('type', TaskMentionedNotification::class)
                ->count(),
        );
    }

    public function test_thread_participant_receives_reply_notification(): void
    {
        $participant = User::factory()->create();
        $this->addTeamMember($participant, $this->team);
        $parent = $this->createParentComment();
        Comment::factory()->create([
            'task_id' => $this->task->id,
            'user_id' => $participant->id,
            'parent_id' => $parent->id,
            'body' => 'Earlier reply',
        ]);
        $body = sprintf(
            '<span data-type="mention" data-id="%s" data-label="%s">@%s</span> new reply.',
            $participant->id,
            $participant->name,
            $participant->name,
        );

        $response = $this->actingAs($this->replier)->post(
            route('comments.store', [$this->team, $this->board, $this->task]),
            [
                'body' => $body,
                'parent_id' => $parent->id,
            ],
        );

        $response->assertRedirect();

        $notification = $participant->notifications()
            ->where('type', TaskCommentReplyNotification::class)
            ->first();

        $this->assertNotNull($notification);
        $this->assertSame($parent->id, $notification->data['parent_comment_id']);
        $this->assertStringContainsString(
            "{$this->replier->name} replied in a thread you participated in on \"Threaded Task\"",
            $notification->data['message'],
        );
        $this->assertSame(
            0,
            $participant->notifications()
                ->where('type', TaskMentionedNotification::class)
                ->count(),
        );
    }

    public function test_reply_notification_respects_in_app_preference(): void
    {
        $this->parentAuthor->update([
            'email_notification_prefs' => [
                'task_comment_replied' => ['in_app' => false, 'email' => true],
            ],
        ]);
        $parent = $this->createParentComment();

        $response = $this->actingAs($this->replier)->post(
            route('comments.store', [$this->team, $this->board, $this->task]),
            [
                'body' => 'Preference test reply',
                'parent_id' => $parent->id,
            ],
        );

        $response->assertRedirect();

        $this->assertDatabaseMissing('notifications', [
            'notifiable_id' => $this->parentAuthor->id,
            'type' => TaskCommentReplyNotification::class,
        ]);
    }

    private function createParentComment(): Comment
    {
        return Comment::factory()->create([
            'task_id' => $this->task->id,
            'user_id' => $this->parentAuthor->id,
            'body' => 'Parent comment',
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
}
