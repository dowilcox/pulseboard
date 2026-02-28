<?php

namespace Tests\Feature;

use App\Models\Board;
use App\Models\Column;
use App\Models\Task;
use App\Models\Team;
use App\Models\TeamMember;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class TaskImageUploadTest extends TestCase
{
    use RefreshDatabase;

    private User $user;

    private Team $team;

    private Board $board;

    private Column $column;

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
        $this->column = Column::factory()->create(['board_id' => $this->board->id]);
    }

    public function test_can_upload_image(): void
    {
        Storage::fake('public');

        $task = Task::factory()->create([
            'board_id' => $this->board->id,
            'column_id' => $this->column->id,
            'created_by' => $this->user->id,
        ]);

        $file = UploadedFile::fake()->image('screenshot.png', 800, 600);

        $response = $this->actingAs($this->user)->post(
            route('tasks.images.store', [$this->team, $this->board, $task]),
            ['image' => $file]
        );

        $response->assertOk();
        $response->assertJsonStructure(['url']);

        Storage::disk('public')->assertExists("task-images/{$task->id}/{$file->hashName()}");
    }

    public function test_rejects_non_image_file(): void
    {
        Storage::fake('public');

        $task = Task::factory()->create([
            'board_id' => $this->board->id,
            'column_id' => $this->column->id,
            'created_by' => $this->user->id,
        ]);

        $file = UploadedFile::fake()->create('document.pdf', 500, 'application/pdf');

        $response = $this->actingAs($this->user)->post(
            route('tasks.images.store', [$this->team, $this->board, $task]),
            ['image' => $file]
        );

        $response->assertSessionHasErrors('image');
    }

    public function test_rejects_oversized_image(): void
    {
        Storage::fake('public');

        $task = Task::factory()->create([
            'board_id' => $this->board->id,
            'column_id' => $this->column->id,
            'created_by' => $this->user->id,
        ]);

        // 6MB file (over 5MB limit)
        $file = UploadedFile::fake()->image('large.png')->size(6 * 1024);

        $response = $this->actingAs($this->user)->post(
            route('tasks.images.store', [$this->team, $this->board, $task]),
            ['image' => $file]
        );

        $response->assertSessionHasErrors('image');
    }
}
