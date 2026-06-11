<?php

namespace Tests\Feature;

use App\Actions\Tasks\UpdateComment;
use App\Models\Board;
use App\Models\Column;
use App\Models\Comment;
use App\Models\Task;
use App\Models\Team;
use App\Models\TeamMember;
use App\Models\User;
use App\Notifications\TaskMentionedNotification;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

class UpdateCommentMentionTest extends TestCase
{
    use RefreshDatabase;

    private User $user;

    private User $teammate;

    private Team $team;

    private Board $board;

    private Column $column;

    private Task $task;

    protected function setUp(): void
    {
        parent::setUp();

        $this->user = User::factory()->create();
        $this->teammate = User::factory()->create();
        $this->team = Team::factory()->create();

        foreach ([['user' => $this->user, 'role' => 'owner'], ['user' => $this->teammate, 'role' => 'member']] as $member) {
            TeamMember::create([
                'team_id' => $this->team->id,
                'user_id' => $member['user']->id,
                'role' => $member['role'],
            ]);
        }

        $this->board = Board::factory()->create(['team_id' => $this->team->id]);
        $this->column = Column::factory()->create(['board_id' => $this->board->id]);
        $this->task = Task::factory()->create([
            'board_id' => $this->board->id,
            'column_id' => $this->column->id,
            'created_by' => $this->user->id,
        ]);
    }

    private function mentionSpan(User $user): string
    {
        return '<span data-type="mention" data-id="'.$user->id.'">@'.$user->name.'</span>';
    }

    public function test_editing_comment_notifies_newly_mentioned_users(): void
    {
        Notification::fake();

        $comment = Comment::create([
            'task_id' => $this->task->id,
            'user_id' => $this->user->id,
            'body' => '<p>Original comment</p>',
        ]);

        $this->actingAs($this->user);

        UpdateComment::run(
            $comment,
            '<p>Hey '.$this->mentionSpan($this->teammate).' please review</p>',
        );

        Notification::assertSentTo($this->teammate, TaskMentionedNotification::class);
    }

    public function test_editing_comment_does_not_renotify_existing_mentions(): void
    {
        Notification::fake();

        $comment = Comment::create([
            'task_id' => $this->task->id,
            'user_id' => $this->user->id,
            'body' => '<p>Hey '.$this->mentionSpan($this->teammate).'</p>',
        ]);

        $this->actingAs($this->user);

        UpdateComment::run(
            $comment,
            '<p>Hey '.$this->mentionSpan($this->teammate).' updated text</p>',
        );

        Notification::assertNothingSent();
    }

    public function test_editing_comment_does_not_notify_the_editor_for_self_mention(): void
    {
        Notification::fake();

        $comment = Comment::create([
            'task_id' => $this->task->id,
            'user_id' => $this->user->id,
            'body' => '<p>Original comment</p>',
        ]);

        $this->actingAs($this->user);

        UpdateComment::run(
            $comment,
            '<p>Note to self '.$this->mentionSpan($this->user).'</p>',
        );

        Notification::assertNothingSent();
    }
}
