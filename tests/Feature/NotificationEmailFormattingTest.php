<?php

namespace Tests\Feature;

use App\Mail\NotificationDigest;
use App\Mail\NotificationEmail;
use App\Models\Board;
use App\Models\Column;
use App\Models\Comment;
use App\Models\Task;
use App\Models\Team;
use App\Models\TeamMember;
use App\Models\User;
use App\Notifications\TaskCommentedNotification;
use App\Notifications\TaskCommentReplyNotification;
use App\Notifications\TaskMentionedNotification;
use App\Support\NotificationText;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Notifications\DatabaseNotification;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;
use Tests\TestCase;

class NotificationEmailFormattingTest extends TestCase
{
    use RefreshDatabase;

    private User $recipient;

    private User $actor;

    private Team $team;

    private Board $board;

    private Column $column;

    private Task $task;

    protected function setUp(): void
    {
        parent::setUp();

        $this->recipient = User::factory()->create();
        $this->actor = User::factory()->create();
        $this->team = Team::factory()->create();
        $this->board = Board::factory()->create(['team_id' => $this->team->id]);
        $this->column = Column::factory()->create(['board_id' => $this->board->id]);
        $this->task = Task::factory()->create([
            'board_id' => $this->board->id,
            'column_id' => $this->column->id,
            'created_by' => $this->actor->id,
            'title' => 'Directory Test',
        ]);

        $this->addTeamMember($this->recipient, $this->team);
        $this->addTeamMember($this->actor, $this->team, 'owner');
    }

    public function test_comment_notifications_store_plain_text_preview_and_full_email_message(): void
    {
        $body = $this->richTextCommentBody();
        $comment = Comment::factory()->create([
            'task_id' => $this->task->id,
            'user_id' => $this->actor->id,
            'body' => $body,
        ]);
        $parentComment = Comment::factory()->create([
            'task_id' => $this->task->id,
            'user_id' => $this->recipient->id,
            'body' => 'Parent comment',
        ]);

        $mentionedData = (new TaskMentionedNotification($this->task, $this->actor, $comment))
            ->toDatabase($this->recipient);
        $commentedData = (new TaskCommentedNotification($this->task, $this->actor, $comment))
            ->toDatabase($this->recipient);
        $replyData = (new TaskCommentReplyNotification($this->task, $this->actor, $comment, $parentComment))
            ->toDatabase($this->recipient);

        $fullComment = NotificationText::toPlainText($body);
        $preview = NotificationText::preview($body, 80);

        $this->assertSame($preview, $mentionedData['comment_preview']);
        $this->assertSame(
            "{$this->actor->name} mentioned you in \"{$this->task->title}\": {$preview}",
            $mentionedData['message'],
        );
        $this->assertSame(
            "{$this->actor->name} mentioned you in \"{$this->task->title}\": {$fullComment}",
            $mentionedData['email_message'],
        );

        $this->assertSame($preview, $commentedData['comment_preview']);
        $this->assertSame(
            "{$this->actor->name} commented on \"{$this->task->title}\": {$preview}",
            $commentedData['message'],
        );
        $this->assertSame(
            "{$this->actor->name} commented on \"{$this->task->title}\": {$fullComment}",
            $commentedData['email_message'],
        );

        $this->assertSame($preview, $replyData['comment_preview']);
        $this->assertSame(
            "{$this->actor->name} replied to your comment on \"{$this->task->title}\": {$preview}",
            $replyData['message'],
        );
        $this->assertSame(
            "{$this->actor->name} replied to your comment on \"{$this->task->title}\": {$fullComment}",
            $replyData['email_message'],
        );

        $this->assertStringNotContainsString('<span', $mentionedData['message']);
        $this->assertStringNotContainsString('<a', $mentionedData['message']);
        $this->assertStringNotContainsString('<span', $commentedData['email_message']);
        $this->assertStringNotContainsString('<span', $replyData['email_message']);
        $this->assertStringContainsString("@{$this->recipient->name}", $mentionedData['email_message']);
        $this->assertStringContainsString('https://example.com/release-notes', $mentionedData['email_message']);
        $this->assertStringContainsString('Tail end for email readability.', $commentedData['email_message']);
        $this->assertStringContainsString('Tail end for email readability.', $replyData['email_message']);
    }

    public function test_single_notification_email_renders_full_plain_text_message(): void
    {
        $comment = Comment::factory()->create([
            'task_id' => $this->task->id,
            'user_id' => $this->actor->id,
            'body' => $this->richTextCommentBody(),
        ]);

        $data = (new TaskMentionedNotification($this->task, $this->actor, $comment))
            ->toDatabase($this->recipient);
        $notification = $this->createNotificationRecord(
            TaskMentionedNotification::class,
            $data,
        );

        $html = (new NotificationEmail($this->recipient, $notification))->render();

        $this->assertStringContainsString($data['email_message'], $html);
        $this->assertStringContainsString('Tail end for email readability.', $html);
        $this->assertStringNotContainsString('data-type="mention"', $html);
        $this->assertStringNotContainsString('&lt;span', $html);
    }

    public function test_notification_digest_renders_plain_text_messages_without_truncation(): void
    {
        $comment = Comment::factory()->create([
            'task_id' => $this->task->id,
            'user_id' => $this->actor->id,
            'body' => $this->richTextCommentBody(),
        ]);

        $commentNotification = $this->createNotificationRecord(
            TaskCommentedNotification::class,
            (new TaskCommentedNotification($this->task, $this->actor, $comment))
                ->toDatabase($this->recipient),
        );
        $automationNotification = $this->createNotificationRecord(
            'App\\Notifications\\AutomationNotification',
            [
                'type' => 'automation',
                'task_title' => $this->task->title,
                'message' => 'Automation <strong>passed</strong> for <span data-type="mention" data-id="'.$this->recipient->id.'" data-label="'.$this->recipient->name.'">@'.$this->recipient->name.'</span>',
            ],
        );

        $html = (new NotificationDigest(
            $this->recipient,
            new Collection([$commentNotification, $automationNotification]),
        ))->render();

        $this->assertStringContainsString($commentNotification->data['email_message'], $html);
        $this->assertStringContainsString("Automation passed for @{$this->recipient->name}", $html);
        $this->assertStringContainsString('Tail end for email readability.', $html);
        $this->assertStringNotContainsString('data-type="mention"', $html);
        $this->assertStringNotContainsString('&lt;strong&gt;', $html);
    }

    private function addTeamMember(User $user, Team $team, string $role = 'member'): void
    {
        TeamMember::create([
            'team_id' => $team->id,
            'user_id' => $user->id,
            'role' => $role,
        ]);
    }

    private function createNotificationRecord(string $type, array $data): DatabaseNotification
    {
        return DatabaseNotification::query()->create([
            'id' => (string) Str::uuid(),
            'type' => $type,
            'notifiable_type' => User::class,
            'notifiable_id' => $this->recipient->id,
            'data' => $data,
        ]);
    }

    private function richTextCommentBody(): string
    {
        return 'Hello <a href="https://example.com/docs">docs</a> and '
            .'<span data-type="mention" data-id="'.$this->recipient->id.'" data-label="'.$this->recipient->name.'">@'.$this->recipient->name.'</span> '
            .'see <https://example.com/release-notes> before release. '
            .'please review the latest changes before release. '
            .'This sentence exists to push the preview past the in-app truncation threshold. '
            .'Tail end for email readability.';
    }
}
