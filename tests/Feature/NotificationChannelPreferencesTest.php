<?php

namespace Tests\Feature;

use App\Events\NotificationCreated;
use App\Mail\NotificationDigest;
use App\Mail\NotificationEmail;
use App\Models\Board;
use App\Models\Column;
use App\Models\Task;
use App\Models\Team;
use App\Models\TeamMember;
use App\Models\User;
use App\Notifications\TaskAssignedNotification;
use App\Notifications\TaskCommentedNotification;
use App\Notifications\TaskDueSoonNotification;
use App\Services\TaskActivityNotifier;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Notifications\DatabaseNotification;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

/**
 * In-app and email are independent: a notification is stored when either
 * channel is on, shown in the bell only when in-app is on, and emailed by
 * notifications:send-emails only when email is on.
 */
class NotificationChannelPreferencesTest extends TestCase
{
    use RefreshDatabase;

    private User $recipient;

    private User $actor;

    private Team $team;

    private Board $board;

    private Task $task;

    protected function setUp(): void
    {
        parent::setUp();

        $this->recipient = User::factory()->create();
        $this->actor = User::factory()->create();
        $this->team = Team::factory()->create();
        foreach ([$this->recipient, $this->actor] as $user) {
            TeamMember::create(['team_id' => $this->team->id, 'user_id' => $user->id, 'role' => 'member']);
        }
        $this->board = Board::factory()->create(['team_id' => $this->team->id]);
        $column = Column::factory()->create(['board_id' => $this->board->id]);
        $this->task = Task::factory()->create([
            'board_id' => $this->board->id,
            'column_id' => $column->id,
            'created_by' => $this->actor->id,
        ]);
    }

    public static function channelCombinations(): array
    {
        return [
            'in-app on, email on' => [true, true],
            'in-app on, email off' => [true, false],
            'in-app off, email on' => [false, true],
            'in-app off, email off' => [false, false],
        ];
    }

    private function setPrefs(string $type, bool $inApp, bool $email): void
    {
        $this->recipient->update([
            'email_notification_prefs' => [$type => ['in_app' => $inApp, 'email' => $email]],
        ]);
    }

    private function runEmailCommand(): void
    {
        // Past the 2-minute settling window.
        $this->travel(3)->minutes();
        $this->artisan('notifications:send-emails')->assertSuccessful();
    }

    #[DataProvider('channelCombinations')]
    public function test_in_app_and_email_are_independent(bool $inApp, bool $email): void
    {
        Mail::fake();
        $this->setPrefs('task_assigned', $inApp, $email);

        $this->recipient->notify(new TaskAssignedNotification($this->task, $this->actor));

        // Stored only when at least one channel wants it.
        $this->assertSame(
            $inApp || $email ? 1 : 0,
            DatabaseNotification::where('notifiable_id', $this->recipient->id)->count(),
        );

        // The bell, the list and the unread count only see in-app rows.
        $this->actingAs($this->recipient)
            ->getJson(route('notifications.index'))
            ->assertOk()
            ->assertJsonCount($inApp ? 1 : 0, 'data')
            ->assertJsonPath('total', $inApp ? 1 : 0)
            ->assertJsonPath('unread_count', $inApp ? 1 : 0);
        $this->assertSame($inApp ? 1 : 0, $this->recipient->unreadNotifications()->count());

        $this->runEmailCommand();

        if ($email) {
            Mail::assertSent(NotificationEmail::class, fn ($mail) => $mail->hasTo($this->recipient->email));
        } else {
            Mail::assertNothingSent();
        }
    }

    #[DataProvider('channelCombinations')]
    public function test_api_inbox_follows_in_app_preference(bool $inApp, bool $email): void
    {
        $this->setPrefs('task_assigned', $inApp, $email);
        $this->recipient->notify(new TaskAssignedNotification($this->task, $this->actor));
        $token = $this->recipient->createToken('test', ['read'])->plainTextToken;

        $this->withHeader('Authorization', "Bearer {$token}")
            ->getJson('/api/v1/notifications')
            ->assertOk()
            ->assertJsonPath('total', $inApp ? 1 : 0)
            ->assertJsonPath('unread_count', $inApp ? 1 : 0);
    }

    public function test_email_only_notifications_still_batch_into_a_digest(): void
    {
        Mail::fake();
        $this->setPrefs('task_assigned', false, true);

        foreach (range(1, 3) as $_) {
            $this->recipient->notify(new TaskAssignedNotification($this->task, $this->actor));
        }

        $this->runEmailCommand();

        Mail::assertSent(NotificationDigest::class, 1);
        Mail::assertNotSent(NotificationEmail::class);
        $this->assertSame(
            0,
            DatabaseNotification::where('notifiable_id', $this->recipient->id)->whereNull('emailed_at')->count(),
        );
    }

    public function test_commenting_stores_an_email_only_record_when_in_app_is_off(): void
    {
        $this->task->assignees()->attach($this->recipient->id, ['assigned_at' => now(), 'assigned_by' => $this->actor->id]);
        $this->setPrefs('task_commented', false, true);

        $this->actingAs($this->actor)
            ->post(route('comments.store', [$this->team, $this->board, $this->task]), ['body' => 'Hello'])
            ->assertRedirect();

        $this->assertDatabaseHas('notifications', [
            'notifiable_id' => $this->recipient->id,
            'type' => TaskCommentedNotification::class,
            'in_app' => false,
        ]);
    }

    #[DataProvider('channelCombinations')]
    public function test_live_broadcast_follows_in_app_preference(bool $inApp, bool $email): void
    {
        Event::fake([NotificationCreated::class]);
        $this->setPrefs('task_assigned', $inApp, $email);

        $notification = new TaskAssignedNotification($this->task, $this->actor);
        $notification->id = (string) Str::uuid();

        app(TaskActivityNotifier::class)->broadcastDatabaseNotification($this->recipient, $notification, 'Assigned');

        if ($inApp) {
            Event::assertDispatched(NotificationCreated::class, fn ($e) => $e->userId === $this->recipient->id);
        } else {
            Event::assertNotDispatched(NotificationCreated::class);
        }
    }

    public function test_live_broadcast_references_the_stored_notification(): void
    {
        Event::fake([NotificationCreated::class]);

        app(TaskActivityNotifier::class)->dispatchActivityNotifications(
            $this->task,
            'assigned',
            ['user_ids' => [$this->recipient->id]],
            $this->actor,
        );

        $stored = DatabaseNotification::where('notifiable_id', $this->recipient->id)->sole();

        Event::assertDispatched(
            NotificationCreated::class,
            fn ($e) => $e->userId === $this->recipient->id && $e->notificationId === $stored->id,
        );
    }

    public function test_email_only_records_are_pruned_after_a_week_but_in_app_ones_are_kept(): void
    {
        $this->setPrefs('task_due_soon', false, true);
        $this->recipient->notify(new TaskDueSoonNotification($this->task));

        $other = User::factory()->create();
        $other->notify(new TaskDueSoonNotification($this->task));

        $this->travel(6)->days();
        $this->artisan('notifications:send-emails')->assertSuccessful();
        $this->assertSame(2, DatabaseNotification::count());

        $this->travel(2)->days();
        $this->artisan('notifications:send-emails')->assertSuccessful();
        $this->assertSame(1, DatabaseNotification::count());
        $this->assertSame(1, $other->notifications()->count());
    }

    public function test_due_soon_reminders_are_not_repeated_for_email_only_users(): void
    {
        $this->setPrefs('task_due_soon', false, true);
        $this->task->update(['due_date' => now()->addDay()->toDateString()]);
        $this->task->assignees()->attach($this->recipient->id, ['assigned_at' => now(), 'assigned_by' => $this->actor->id]);

        $this->artisan('tasks:send-due-reminders')->assertSuccessful();
        $this->travel(1)->hours();
        $this->artisan('tasks:send-due-reminders')->assertSuccessful();

        $this->assertSame(1, DatabaseNotification::where('notifiable_id', $this->recipient->id)->count());
    }
}
