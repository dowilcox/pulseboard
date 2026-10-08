<?php

namespace Tests\Feature;

use App\Models\Board;
use App\Models\Column;
use App\Models\Task;
use App\Models\Team;
use App\Models\TeamMember;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class NotificationControllerTest extends TestCase
{
    use RefreshDatabase;

    private User $user;

    protected function setUp(): void
    {
        parent::setUp();

        $this->user = User::factory()->create();
    }

    private function createNotification(User $user, ?string $readAt = null): string
    {
        $id = Str::uuid()->toString();

        $user->notifications()->create([
            'id' => $id,
            'type' => 'App\\Notifications\\TaskAssignedNotification',
            'data' => [
                'type' => 'task_assigned',
                'task_id' => Str::uuid()->toString(),
                'task_title' => 'Test Task',
                'board_id' => Str::uuid()->toString(),
                'team_id' => Str::uuid()->toString(),
                'message' => 'You were assigned a task',
            ],
            'read_at' => $readAt,
        ]);

        return $id;
    }

    public function test_can_list_notifications(): void
    {
        $this->createNotification($this->user);
        $this->createNotification($this->user, now());

        $response = $this->actingAs($this->user)
            ->getJson(route('notifications.index'));

        $response->assertOk();
        $response->assertJsonCount(2, 'data');
        $response->assertJsonPath('unread_count', 1);
    }

    public function test_unread_count_is_independent_of_pagination(): void
    {
        for ($i = 0; $i < 15; $i++) {
            $this->createNotification($this->user);
        }
        for ($i = 0; $i < 10; $i++) {
            $this->createNotification($this->user, now());
        }

        $response = $this->actingAs($this->user)
            ->getJson(route('notifications.index'));

        $response->assertOk();
        $response->assertJsonCount(20, 'data');
        $response->assertJsonPath('total', 25);
        $response->assertJsonPath('unread_count', 15);
    }

    public function test_can_mark_notification_as_read(): void
    {
        $id = $this->createNotification($this->user);

        $response = $this->actingAs($this->user)
            ->patchJson(route('notifications.read', $id));

        $response->assertOk();
        $response->assertJson(['success' => true]);

        $this->assertNotNull(
            $this->user->notifications()->find($id)->read_at
        );
    }

    public function test_can_mark_all_notifications_as_read(): void
    {
        $this->createNotification($this->user);
        $this->createNotification($this->user);

        $response = $this->actingAs($this->user)
            ->postJson(route('notifications.read-all'));

        $response->assertOk();
        $response->assertJson(['success' => true]);

        $this->assertEquals(0, $this->user->unreadNotifications()->count());
    }

    /**
     * @param  array<string, mixed>  $data
     */
    private function notifyWith(User $user, array $data, ?string $createdAt = null): string
    {
        $id = Str::uuid()->toString();

        $notification = $user->notifications()->create([
            'id' => $id,
            'type' => 'App\\Notifications\\TaskAssignedNotification',
            'data' => array_merge(['type' => 'task_assigned', 'message' => 'Hello'], $data),
            'read_at' => null,
        ]);

        if ($createdAt) {
            $notification->forceFill(['created_at' => $createdAt])->save();
        }

        return $id;
    }

    /**
     * @return array{0: Team, 1: Board, 2: Task}
     */
    private function memberTask(): array
    {
        $team = Team::factory()->create(['name' => 'Engineering']);
        TeamMember::create(['team_id' => $team->id, 'user_id' => $this->user->id, 'role' => 'member']);
        $board = Board::factory()->create(['team_id' => $team->id, 'name' => 'Platform']);
        $column = Column::factory()->create(['board_id' => $board->id]);
        $task = Task::factory()->create([
            'board_id' => $board->id,
            'column_id' => $column->id,
            'created_by' => $this->user->id,
            'title' => 'Fix login',
            'task_number' => 7,
        ]);

        return [$team, $board, $task];
    }

    private function itemFor(string $id): array
    {
        $response = $this->actingAs($this->user)->getJson(route('notifications.index'));
        $response->assertOk();

        return collect($response->json('data'))->firstWhere('id', $id);
    }

    public function test_url_is_built_from_current_records_not_stale_payload_slugs(): void
    {
        [$team, $board, $task] = $this->memberTask();

        $id = $this->notifyWith($this->user, [
            'task_id' => $task->id,
            'board_id' => $board->id,
            'team_id' => $team->id,
            'team_slug' => 'old-team',
            'board_slug' => 'old-board',
            'task_slug' => '7-old-title',
        ]);

        $item = $this->itemFor($id);

        $this->assertSame(
            route('tasks.show', [$team->slug, $board->slug, $task->slug], false),
            $item['url'],
        );
        $this->assertSame(['team_name' => 'Engineering', 'board_name' => 'Platform'], $item['context']);
    }

    public function test_url_follows_a_task_that_moved_to_another_board(): void
    {
        [$team, , $task] = $this->memberTask();
        $newBoard = Board::factory()->create(['team_id' => $team->id, 'name' => 'Mobile']);
        $newColumn = Column::factory()->create(['board_id' => $newBoard->id]);

        $id = $this->notifyWith($this->user, [
            'task_id' => $task->id,
            'board_id' => $task->board_id,
            'team_id' => $team->id,
        ]);
        $task->update(['board_id' => $newBoard->id, 'column_id' => $newColumn->id]);

        $item = $this->itemFor($id);

        $this->assertSame(route('tasks.show', [$team->slug, $newBoard->slug, $task->fresh()->slug], false), $item['url']);
        $this->assertSame('Mobile', $item['context']['board_name']);
    }

    public function test_url_falls_back_to_the_board_then_the_team(): void
    {
        [$team, $board] = $this->memberTask();

        $deletedTask = $this->notifyWith($this->user, [
            'task_id' => Str::uuid()->toString(),
            'board_id' => $board->id,
            'team_id' => $team->id,
        ]);
        $deletedBoard = $this->notifyWith($this->user, [
            'task_id' => Str::uuid()->toString(),
            'board_id' => Str::uuid()->toString(),
            'team_id' => $team->id,
        ]);

        $this->assertSame(route('teams.boards.show', [$team->slug, $board->slug], false), $this->itemFor($deletedTask)['url']);

        $teamOnly = $this->itemFor($deletedBoard);
        $this->assertSame(route('teams.show', $team->slug, false), $teamOnly['url']);
        $this->assertSame(['team_name' => 'Engineering', 'board_name' => null], $teamOnly['context']);
    }

    public function test_url_is_null_when_nothing_resolves_or_the_user_left_the_team(): void
    {
        $orphan = $this->createNotification($this->user);

        $foreignTeam = Team::factory()->create();
        $foreignBoard = Board::factory()->create(['team_id' => $foreignTeam->id]);
        $noAccess = $this->notifyWith($this->user, [
            'board_id' => $foreignBoard->id,
            'team_id' => $foreignTeam->id,
        ]);

        $legacy = $this->notifyWith($this->user, ['task_id' => 'not-a-uuid']);

        foreach ([$orphan, $noAccess, $legacy] as $id) {
            $item = $this->itemFor($id);
            $this->assertNull($item['url']);
            $this->assertNull($item['context']);
        }
    }

    public function test_notifications_paginate_newest_first(): void
    {
        for ($i = 0; $i < 25; $i++) {
            $this->notifyWith($this->user, ['message' => "Note {$i}"], now()->subMinutes(25 - $i)->toDateTimeString());
        }

        $first = $this->actingAs($this->user)->getJson(route('notifications.index'));
        $first->assertOk()
            ->assertJsonCount(20, 'data')
            ->assertJsonPath('current_page', 1)
            ->assertJsonPath('last_page', 2)
            ->assertJsonPath('data.0.data.message', 'Note 24');

        $second = $this->actingAs($this->user)->getJson(route('notifications.index', ['page' => 2]));
        $second->assertOk()
            ->assertJsonCount(5, 'data')
            ->assertJsonPath('current_page', 2)
            ->assertJsonPath('data.4.data.message', 'Note 0');

        $ids = collect($first->json('data'))->pluck('id')->merge(collect($second->json('data'))->pluck('id'));
        $this->assertCount(25, $ids->unique());
    }

    public function test_marking_one_notification_read_leaves_the_others_unread(): void
    {
        $target = $this->createNotification($this->user);
        $other = $this->createNotification($this->user);

        $this->actingAs($this->user)
            ->patchJson(route('notifications.read', $target))
            ->assertOk();

        $this->assertNotNull($this->user->notifications()->find($target)->read_at);
        $this->assertNull($this->user->notifications()->find($other)->read_at);

        $this->actingAs($this->user)
            ->getJson(route('notifications.index'))
            ->assertJsonPath('unread_count', 1);
    }

    public function test_cannot_mark_another_users_notification_read(): void
    {
        $someoneElse = User::factory()->create();
        $theirs = $this->createNotification($someoneElse);

        $this->actingAs($this->user)
            ->patchJson(route('notifications.read', $theirs))
            ->assertNotFound();

        $this->assertNull($someoneElse->notifications()->find($theirs)->read_at);
    }
}
