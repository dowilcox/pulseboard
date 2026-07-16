<?php

namespace Tests\Feature\Api\V1;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class NotificationApiTest extends TestCase
{
    use RefreshDatabase;

    private User $user;

    private string $token;

    protected function setUp(): void
    {
        parent::setUp();

        $this->user = User::factory()->create();
        $this->token = $this->user->createToken('test', ['read', 'write'])->plainTextToken;
    }

    private function api(?string $token = null): static
    {
        return $this->withHeader('Authorization', 'Bearer '.($token ?? $this->token));
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
                'message' => 'You were assigned a task',
            ],
            'read_at' => $readAt,
        ]);

        return $id;
    }

    public function test_list_notifications(): void
    {
        $this->createNotification($this->user);
        $this->createNotification($this->user, now());

        $response = $this->api()->getJson('/api/v1/notifications');

        $response->assertOk();
        $response->assertJsonCount(2, 'data');
        $response->assertJsonPath('total', 2);
        $response->assertJsonPath('unread_count', 1);
        $response->assertJsonStructure([
            'data', 'current_page', 'last_page', 'per_page', 'total',
            'next_page_url', 'prev_page_url', 'unread_count',
        ]);
    }

    public function test_notifications_are_scoped_to_token_user(): void
    {
        $other = User::factory()->create();
        $this->createNotification($other);
        $this->createNotification($this->user);

        $response = $this->api()->getJson('/api/v1/notifications');

        $response->assertOk();
        $response->assertJsonCount(1, 'data');
    }

    public function test_mark_notification_read(): void
    {
        $id = $this->createNotification($this->user);

        $response = $this->api()->patchJson("/api/v1/notifications/{$id}/read");

        $response->assertNoContent();
        $this->assertNotNull($this->user->notifications()->find($id)->read_at);
    }

    public function test_cannot_mark_another_users_notification_read(): void
    {
        $other = User::factory()->create();
        $id = $this->createNotification($other);

        $this->api()
            ->patchJson("/api/v1/notifications/{$id}/read")
            ->assertNotFound();

        $this->assertNull($other->notifications()->find($id)->read_at);
    }

    public function test_mark_all_read(): void
    {
        $this->createNotification($this->user);
        $this->createNotification($this->user);

        $response = $this->api()->postJson('/api/v1/notifications/read-all');

        $response->assertNoContent();
        $this->assertEquals(0, $this->user->unreadNotifications()->count());
    }

    public function test_clear_all(): void
    {
        $this->createNotification($this->user);
        $other = User::factory()->create();
        $otherId = $this->createNotification($other);

        $response = $this->api()->deleteJson('/api/v1/notifications');

        $response->assertNoContent();
        $this->assertEquals(0, $this->user->notifications()->count());
        $this->assertNotNull($other->notifications()->find($otherId));
    }

    public function test_notification_mutations_require_write_ability(): void
    {
        $token = $this->user->createToken('read-only', ['read'])->plainTextToken;
        $id = $this->createNotification($this->user);

        $this->api($token)->patchJson("/api/v1/notifications/{$id}/read")->assertForbidden();
        $this->api($token)->postJson('/api/v1/notifications/read-all')->assertForbidden();
        $this->api($token)->deleteJson('/api/v1/notifications')->assertForbidden();
    }
}
