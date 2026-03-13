<?php

namespace Tests\Feature;

use App\Models\Board;
use App\Models\Team;
use App\Models\TeamMember;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class BoardAvatarTest extends TestCase
{
    use RefreshDatabase;

    private User $user;

    private Team $team;

    private Board $board;

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
        $this->board = Board::factory()->create(['team_id' => $this->team->id]);
    }

    public function test_can_upload_board_avatar(): void
    {
        Storage::fake('public');

        $file = UploadedFile::fake()->image('avatar.jpg', 400, 400);

        $response = $this->actingAs($this->user)->post(
            route('teams.boards.upload-image', [$this->team, $this->board]),
            ['image' => $file]
        );

        $response->assertOk();
        $response->assertJsonStructure(['image_url']);

        $this->board->refresh();
        $media = $this->board->getFirstMedia('avatar');
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
            route('teams.boards.upload-image', [$this->team, $this->board]),
            ['image' => $file1]
        );

        $this->actingAs($this->user)->post(
            route('teams.boards.upload-image', [$this->team, $this->board]),
            ['image' => $file2]
        );

        $this->board->refresh();
        $this->assertCount(1, $this->board->getMedia('avatar'));
    }

    public function test_can_delete_board_avatar(): void
    {
        Storage::fake('public');

        $file = UploadedFile::fake()->image('avatar.jpg', 400, 400);
        $this->actingAs($this->user)->post(
            route('teams.boards.upload-image', [$this->team, $this->board]),
            ['image' => $file]
        );

        $response = $this->actingAs($this->user)->delete(
            route('teams.boards.delete-image', [$this->team, $this->board])
        );

        $response->assertOk();
        $this->board->refresh();
        $this->assertNull($this->board->getFirstMedia('avatar'));
    }

    public function test_image_url_accessor_returns_conversion_url(): void
    {
        Storage::fake('public');

        $file = UploadedFile::fake()->image('avatar.jpg', 400, 400);
        $this->actingAs($this->user)->post(
            route('teams.boards.upload-image', [$this->team, $this->board]),
            ['image' => $file]
        );

        $this->board->refresh();
        $this->assertNotNull($this->board->image_url);
        $this->assertStringContainsString('avatar', $this->board->image_url);
    }

    public function test_image_url_is_null_without_avatar(): void
    {
        $this->assertNull($this->board->image_url);
    }

    public function test_non_admin_cannot_upload_avatar(): void
    {
        Storage::fake('public');

        $member = User::factory()->create();
        TeamMember::create([
            'team_id' => $this->team->id,
            'user_id' => $member->id,
            'role' => 'member',
        ]);

        $file = UploadedFile::fake()->image('avatar.jpg', 400, 400);

        $response = $this->actingAs($member)->post(
            route('teams.boards.upload-image', [$this->team, $this->board]),
            ['image' => $file]
        );

        $response->assertForbidden();
    }
}
