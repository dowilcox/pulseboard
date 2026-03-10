<?php

namespace Tests\Feature;

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
        $this->createNotification($this->user);

        $response = $this->actingAs($this->user)
            ->getJson(route('notifications.index'));

        $response->assertOk();
        $response->assertJsonCount(2, 'data');
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
}
