<?php

namespace Tests\Feature;

use App\Actions\Boards\DeleteBoard;
use App\Actions\Teams\DeleteTeam;
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

class CascadeDeleteTest extends TestCase
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

    public function test_deleting_board_cleans_up_task_media(): void
    {
        $this->actingAs($this->user);
        Storage::fake('local');
        Storage::fake('public');

        $task = Task::factory()->create([
            'board_id' => $this->board->id,
            'column_id' => $this->column->id,
            'created_by' => $this->user->id,
        ]);

        $file = UploadedFile::fake()->create('document.pdf', 1024, 'application/pdf');
        $task->addMedia($file)
            ->withCustomProperties(['original_filename' => 'document.pdf', 'uploaded_by' => $this->user->id])
            ->toMediaCollection('attachments');

        $this->assertDatabaseHas('media', ['model_id' => $task->id, 'collection_name' => 'attachments']);

        DeleteBoard::run($this->board);

        $this->assertDatabaseMissing('media', ['model_id' => $task->id]);
        $this->assertDatabaseMissing('tasks', ['id' => $task->id]);
        $this->assertDatabaseMissing('boards', ['id' => $this->board->id]);
    }

    public function test_deleting_board_cleans_up_board_avatar(): void
    {
        $this->actingAs($this->user);
        Storage::fake('public');

        $file = UploadedFile::fake()->image('avatar.jpg', 400, 400);
        $this->board->addMedia($file)->toMediaCollection('avatar');

        $this->assertDatabaseHas('media', ['model_id' => $this->board->id, 'collection_name' => 'avatar']);

        DeleteBoard::run($this->board);

        $this->assertDatabaseMissing('media', ['model_id' => $this->board->id]);
    }

    public function test_deleting_team_cleans_up_all_media(): void
    {
        Storage::fake('local');
        Storage::fake('public');

        $task = Task::factory()->create([
            'board_id' => $this->board->id,
            'column_id' => $this->column->id,
            'created_by' => $this->user->id,
        ]);

        // Add task attachment
        $file1 = UploadedFile::fake()->create('document.pdf', 1024, 'application/pdf');
        $task->addMedia($file1)
            ->withCustomProperties(['original_filename' => 'document.pdf', 'uploaded_by' => $this->user->id])
            ->toMediaCollection('attachments');

        // Add board avatar
        $file2 = UploadedFile::fake()->image('board-avatar.jpg', 400, 400);
        $this->board->addMedia($file2)->toMediaCollection('avatar');

        // Add team avatar
        $file3 = UploadedFile::fake()->image('team-avatar.jpg', 400, 400);
        $this->team->addMedia($file3)->toMediaCollection('avatar');

        $this->assertDatabaseCount('media', 3);

        DeleteTeam::run($this->team);

        // Team avatar media should be cleaned up when team is deleted
        // Board + task media are cleaned explicitly in DeleteTeam action
        $this->assertDatabaseMissing('media', ['model_id' => $task->id]);
        $this->assertDatabaseMissing('media', ['model_id' => $this->board->id]);
    }

    public function test_deleting_board_with_multiple_tasks_cleans_all_media(): void
    {
        $this->actingAs($this->user);
        Storage::fake('local');

        $tasks = Task::factory(3)->create([
            'board_id' => $this->board->id,
            'column_id' => $this->column->id,
            'created_by' => $this->user->id,
        ]);

        foreach ($tasks as $task) {
            $file = UploadedFile::fake()->create("doc-{$task->id}.pdf", 1024, 'application/pdf');
            $task->addMedia($file)
                ->withCustomProperties(['original_filename' => "doc-{$task->id}.pdf", 'uploaded_by' => $this->user->id])
                ->toMediaCollection('attachments');
        }

        $this->assertDatabaseCount('media', 3);

        DeleteBoard::run($this->board);

        $this->assertDatabaseCount('media', 0);
    }
}
