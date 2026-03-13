<?php

namespace Tests\Feature;

use App\Models\Team;
use App\Models\TeamMember;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class TeamAvatarTest extends TestCase
{
    use RefreshDatabase;

    private User $user;

    private Team $team;

    protected function setUp(): void
    {
        parent::setUp();

        $this->user = User::factory()->create();
        $this->team = Team::factory()->create();
        TeamMember::create([
            'team_id' => $this->team->id,
            'user_id' => $this->user->id,
            'role' => 'owner',
        ]);
    }

    public function test_can_upload_team_avatar(): void
    {
        Storage::fake('public');

        $file = UploadedFile::fake()->image('avatar.jpg', 400, 400);

        $response = $this->actingAs($this->user)->post(
            route('teams.upload-image', $this->team),
            ['image' => $file]
        );

        $response->assertOk();
        $response->assertJsonStructure(['image_url']);

        $this->team->refresh();
        $media = $this->team->getFirstMedia('avatar');
        $this->assertNotNull($media);
        $this->assertTrue($media->hasGeneratedConversion('avatar'));
        $this->assertTrue($media->hasGeneratedConversion('avatar-lg'));
    }

    public function test_upload_replaces_existing_avatar(): void
    {
        Storage::fake('public');

        $file1 = UploadedFile::fake()->image('first.jpg', 400, 400);
        $file2 = UploadedFile::fake()->image('second.jpg', 400, 400);

        $this->actingAs($this->user)->post(
            route('teams.upload-image', $this->team),
            ['image' => $file1]
        );

        $this->actingAs($this->user)->post(
            route('teams.upload-image', $this->team),
            ['image' => $file2]
        );

        $this->team->refresh();
        $this->assertCount(1, $this->team->getMedia('avatar'));
    }

    public function test_can_delete_team_avatar(): void
    {
        Storage::fake('public');

        $file = UploadedFile::fake()->image('avatar.jpg', 400, 400);
        $this->actingAs($this->user)->post(
            route('teams.upload-image', $this->team),
            ['image' => $file]
        );

        $response = $this->actingAs($this->user)->delete(
            route('teams.delete-image', $this->team)
        );

        $response->assertOk();
        $this->team->refresh();
        $this->assertNull($this->team->getFirstMedia('avatar'));
    }

    public function test_image_url_accessor_returns_conversion_url(): void
    {
        Storage::fake('public');

        $file = UploadedFile::fake()->image('avatar.jpg', 400, 400);
        $this->actingAs($this->user)->post(
            route('teams.upload-image', $this->team),
            ['image' => $file]
        );

        $this->team->refresh();
        $this->assertNotNull($this->team->image_url);
        $this->assertStringContainsString('avatar', $this->team->image_url);
    }

    public function test_image_url_is_null_without_avatar(): void
    {
        $this->assertNull($this->team->image_url);
    }
}
