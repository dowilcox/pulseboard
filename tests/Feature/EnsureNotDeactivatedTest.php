<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class EnsureNotDeactivatedTest extends TestCase
{
    use RefreshDatabase;

    public function test_active_user_can_access_routes(): void
    {
        $user = User::factory()->create(['deactivated_at' => null]);

        $response = $this->actingAs($user)->get('/dashboard');

        $response->assertOk();
    }

    public function test_deactivated_user_is_redirected_to_login(): void
    {
        $user = User::factory()->create(['deactivated_at' => now()]);

        $response = $this->actingAs($user)->get('/dashboard');

        $response->assertRedirect(route('login'));
    }

    public function test_deactivated_user_json_request_gets_403(): void
    {
        $user = User::factory()->create(['deactivated_at' => now()]);

        $response = $this->actingAs($user)->getJson('/dashboard');

        $response->assertStatus(403);
        $response->assertJson(['message' => 'Your account has been deactivated.']);
    }

    public function test_deactivated_user_session_is_invalidated(): void
    {
        $user = User::factory()->create(['deactivated_at' => now()]);

        $this->actingAs($user)->get('/dashboard');

        // After redirect, user should be logged out
        $this->assertGuest();
    }
}
