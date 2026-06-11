<?php

namespace Tests\Feature;

use App\Actions\Boards\DeleteColumn;
use App\Actions\Boards\ReorderColumns;
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

class ColumnTaskMediaCleanupTest extends TestCase
{
    use RefreshDatabase;

    private User $user;

    private Team $team;

    private Board $board;

    private Column $column;

    private Column $otherColumn;

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
        $this->column = Column::factory()->create([
            'board_id' => $this->board->id,
            'sort_order' => 0,
        ]);
        $this->otherColumn = Column::factory()->create([
            'board_id' => $this->board->id,
            'sort_order' => 1,
        ]);
    }

    private function createTaskWithAttachment(): Task
    {
        $task = Task::factory()->create([
            'board_id' => $this->board->id,
            'column_id' => $this->column->id,
            'created_by' => $this->user->id,
        ]);

        $file = UploadedFile::fake()->create('document.pdf', 1024, 'application/pdf');
        $task->addMedia($file)
            ->withCustomProperties(['original_filename' => 'document.pdf', 'uploaded_by' => $this->user->id])
            ->toMediaCollection('attachments');

        return $task;
    }

    public function test_deleting_column_without_target_cleans_up_task_media(): void
    {
        $this->actingAs($this->user);
        Storage::fake('local');
        Storage::fake('public');

        $task = $this->createTaskWithAttachment();

        $this->assertDatabaseHas('media', ['model_id' => $task->id, 'collection_name' => 'attachments']);

        DeleteColumn::run($this->column);

        $this->assertDatabaseMissing('media', ['model_id' => $task->id]);
        $this->assertDatabaseMissing('tasks', ['id' => $task->id]);
        $this->assertDatabaseMissing('columns', ['id' => $this->column->id]);
    }

    public function test_deleting_column_with_target_moves_tasks_and_keeps_media(): void
    {
        $this->actingAs($this->user);
        Storage::fake('local');
        Storage::fake('public');

        $task = $this->createTaskWithAttachment();

        DeleteColumn::run($this->column, $this->otherColumn);

        $this->assertDatabaseHas('tasks', ['id' => $task->id, 'column_id' => $this->otherColumn->id]);
        $this->assertDatabaseHas('media', ['model_id' => $task->id, 'collection_name' => 'attachments']);
        $this->assertDatabaseMissing('columns', ['id' => $this->column->id]);
    }

    public function test_reorder_columns_destroy_cleans_up_task_media(): void
    {
        $this->actingAs($this->user);
        Storage::fake('local');
        Storage::fake('public');

        $task = $this->createTaskWithAttachment();

        $this->assertDatabaseHas('media', ['model_id' => $task->id, 'collection_name' => 'attachments']);

        ReorderColumns::run($this->board, [
            [
                'id' => $this->column->id,
                '_destroy' => true,
            ],
            [
                'id' => $this->otherColumn->id,
                'name' => $this->otherColumn->name,
                'color' => $this->otherColumn->color,
                'sort_order' => 0,
            ],
        ]);

        $this->assertDatabaseMissing('media', ['model_id' => $task->id]);
        $this->assertDatabaseMissing('tasks', ['id' => $task->id]);
        $this->assertDatabaseMissing('columns', ['id' => $this->column->id]);
        $this->assertDatabaseHas('columns', ['id' => $this->otherColumn->id]);
    }
}
