<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class ProfilePreferencesTest extends TestCase
{
    use RefreshDatabase;

    private User $user;

    protected function setUp(): void
    {
        parent::setUp();
        $this->user = User::factory()->create();
    }

    // ---------------------------------------------------------------
    // Notification preferences
    // ---------------------------------------------------------------

    public function test_can_update_notification_preferences(): void
    {
        $response = $this->actingAs($this->user)->patch(
            route('profile.notifications.update'),
            [
                'prefs' => [
                    'task_assigned' => ['in_app' => true, 'email' => false],
                    'task_commented' => ['in_app' => true, 'email' => true],
                    'task_comment_replied' => ['in_app' => true, 'email' => true],
                ],
            ]
        );

        $response->assertRedirect(route('profile.edit'));
        $this->user->refresh();
        $this->assertFalse($this->user->email_notification_prefs['task_assigned']['email']);
        $this->assertTrue($this->user->email_notification_prefs['task_commented']['email']);
        $this->assertTrue($this->user->email_notification_prefs['task_comment_replied']['email']);
    }

    public function test_notification_preferences_filter_invalid_types(): void
    {
        $response = $this->actingAs($this->user)->patch(
            route('profile.notifications.update'),
            [
                'prefs' => [
                    'task_assigned' => ['in_app' => true, 'email' => false],
                    'invalid_type' => ['in_app' => true],
                ],
            ]
        );

        $response->assertRedirect(route('profile.edit'));
        $this->user->refresh();
        $this->assertArrayHasKey('task_assigned', $this->user->email_notification_prefs);
        $this->assertArrayNotHasKey('invalid_type', $this->user->email_notification_prefs);
    }

    public function test_notification_preferences_filter_invalid_channels(): void
    {
        $response = $this->actingAs($this->user)->patch(
            route('profile.notifications.update'),
            [
                'prefs' => [
                    'task_assigned' => ['in_app' => true, 'sms' => true],
                ],
            ]
        );

        $response->assertRedirect(route('profile.edit'));
        $this->user->refresh();
        $this->assertArrayHasKey('in_app', $this->user->email_notification_prefs['task_assigned']);
        $this->assertArrayNotHasKey('sms', $this->user->email_notification_prefs['task_assigned']);
    }

    public function test_notification_preferences_requires_prefs(): void
    {
        $response = $this->actingAs($this->user)->patch(
            route('profile.notifications.update'),
            []
        );

        $response->assertSessionHasErrors('prefs');
    }

    // ---------------------------------------------------------------
    // UI preferences
    // ---------------------------------------------------------------

    public function test_can_update_activity_sort_order(): void
    {
        $response = $this->actingAs($this->user)->patch(
            route('profile.ui-preferences.update'),
            ['activity_sort_order' => 'desc']
        );

        $response->assertRedirect();
        $this->user->refresh();
        $this->assertEquals('desc', $this->user->ui_preferences['activity_sort_order']);
    }

    public function test_activity_sort_order_rejects_invalid_value(): void
    {
        $response = $this->actingAs($this->user)->patch(
            route('profile.ui-preferences.update'),
            ['activity_sort_order' => 'random']
        );

        $response->assertSessionHasErrors('activity_sort_order');
    }

    public function test_can_update_board_order(): void
    {
        $boardA = Str::uuid()->toString();
        $boardB = Str::uuid()->toString();

        $response = $this->actingAs($this->user)->patch(
            route('profile.ui-preferences.update'),
            [
                'board_order' => [
                    'team-1' => [$boardA, $boardB],
                ],
            ]
        );

        $response->assertRedirect();
        $this->user->refresh();
        $this->assertEquals(
            [$boardA, $boardB],
            $this->user->ui_preferences['board_order']['team-1']
        );
    }

    public function test_board_order_merges_with_existing(): void
    {
        $boardX = Str::uuid()->toString();
        $boardY = Str::uuid()->toString();
        $boardA = Str::uuid()->toString();
        $boardB = Str::uuid()->toString();

        // Set initial preferences
        $this->user->update([
            'ui_preferences' => [
                'board_order' => [
                    'team-1' => [$boardX, $boardY],
                ],
            ],
        ]);

        $response = $this->actingAs($this->user)->patch(
            route('profile.ui-preferences.update'),
            [
                'board_order' => [
                    'team-2' => [$boardA, $boardB],
                ],
            ]
        );

        $response->assertRedirect();
        $this->user->refresh();
        // Both teams should be present
        $this->assertEquals([$boardX, $boardY], $this->user->ui_preferences['board_order']['team-1']);
        $this->assertEquals([$boardA, $boardB], $this->user->ui_preferences['board_order']['team-2']);
    }

    public function test_ui_preferences_merge_preserves_existing(): void
    {
        $this->user->update([
            'ui_preferences' => [
                'activity_sort_order' => 'asc',
                'some_other_pref' => 'value',
            ],
        ]);

        $response = $this->actingAs($this->user)->patch(
            route('profile.ui-preferences.update'),
            ['activity_sort_order' => 'desc']
        );

        $response->assertRedirect();
        $this->user->refresh();
        $this->assertEquals('desc', $this->user->ui_preferences['activity_sort_order']);
        $this->assertEquals('value', $this->user->ui_preferences['some_other_pref']);
    }
}
