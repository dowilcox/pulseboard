<?php

namespace Tests\Feature;

use App\Actions\Media\UploadModelAvatar;
use App\Models\Board;
use App\Models\Team;
use App\Models\TeamMember;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class AvatarUploadValidationTest extends TestCase
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

    public function test_oversized_team_avatar_is_rejected(): void
    {
        Storage::fake('public');

        $maxKb = (int) config('uploads.max_size.avatar');
        $file = UploadedFile::fake()->image('huge.jpg')->size($maxKb + 1);

        $response = $this->actingAs($this->user)->postJson(
            route('teams.upload-image', $this->team),
            ['image' => $file]
        );

        $response->assertStatus(422);
        $response->assertJsonValidationErrors('image');
        $this->assertNull($this->team->refresh()->getFirstMedia('avatar'));
    }

    public function test_oversized_board_avatar_is_rejected(): void
    {
        Storage::fake('public');

        $board = Board::factory()->create(['team_id' => $this->team->id]);

        $maxKb = (int) config('uploads.max_size.avatar');
        $file = UploadedFile::fake()->image('huge.jpg')->size($maxKb + 1);

        $response = $this->actingAs($this->user)->postJson(
            route('teams.boards.upload-image', [$this->team, $board]),
            ['image' => $file]
        );

        $response->assertStatus(422);
        $response->assertJsonValidationErrors('image');
    }

    public function test_size_limit_message_is_derived_from_config(): void
    {
        $this->assertSame('2MB', UploadModelAvatar::maxSizeForHumans(2048));
        $this->assertSame('1.5MB', UploadModelAvatar::maxSizeForHumans(1536));
        $this->assertSame('512KB', UploadModelAvatar::maxSizeForHumans(512));
    }
}
