<?php

namespace Tests\Feature;

use App\Models\Attachment;
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

class AttachmentControllerTest extends TestCase
{
    use RefreshDatabase;

    private User $user;

    private Team $team;

    private Board $board;

    private Column $column;

    private Task $task;

    protected function setUp(): void
    {
        parent::setUp();

        $this->user = User::factory()->create();
        $this->team = Team::factory()->create();
        $this->addTeamMember($this->user, $this->team, 'owner');
        $this->board = Board::factory()->create(['team_id' => $this->team->id]);
        $this->column = Column::factory()->create(['board_id' => $this->board->id]);
        $this->task = Task::factory()->create([
            'board_id' => $this->board->id,
            'column_id' => $this->column->id,
            'created_by' => $this->user->id,
        ]);
    }

    private function addTeamMember(User $user, Team $team, string $role = 'member'): void
    {
        TeamMember::create([
            'team_id' => $team->id,
            'user_id' => $user->id,
            'role' => $role,
        ]);
    }

    public function test_team_member_can_upload_attachment(): void
    {
        Storage::fake('local');

        $file = UploadedFile::fake()->create('document.pdf', 1024, 'application/pdf');

        $response = $this->actingAs($this->user)->post(
            route('attachments.store', [$this->team, $this->board, $this->task]),
            ['file' => $file]
        );

        $response->assertRedirect();
        $this->assertDatabaseHas('attachments', [
            'task_id' => $this->task->id,
            'user_id' => $this->user->id,
            'filename' => 'document.pdf',
            'mime_type' => 'application/pdf',
        ]);
    }

    public function test_upload_requires_file(): void
    {
        $response = $this->actingAs($this->user)->post(
            route('attachments.store', [$this->team, $this->board, $this->task]),
            []
        );

        $response->assertSessionHasErrors('file');
    }

    public function test_upload_rejects_file_over_10mb(): void
    {
        Storage::fake('local');

        $file = UploadedFile::fake()->create('large.zip', 11000, 'application/zip');

        $response = $this->actingAs($this->user)->post(
            route('attachments.store', [$this->team, $this->board, $this->task]),
            ['file' => $file]
        );

        $response->assertSessionHasErrors('file');
    }

    public function test_non_member_cannot_upload_attachment(): void
    {
        Storage::fake('local');

        $outsider = User::factory()->create();
        $file = UploadedFile::fake()->create('document.pdf', 1024, 'application/pdf');

        $response = $this->actingAs($outsider)->post(
            route('attachments.store', [$this->team, $this->board, $this->task]),
            ['file' => $file]
        );

        $response->assertForbidden();
    }

    public function test_team_member_can_download_attachment(): void
    {
        Storage::fake('local');

        $file = UploadedFile::fake()->create('document.pdf', 1024, 'application/pdf');
        $path = $file->store("attachments/{$this->task->id}", 'local');

        $attachment = Attachment::create([
            'task_id' => $this->task->id,
            'user_id' => $this->user->id,
            'filename' => 'document.pdf',
            'file_path' => $path,
            'file_size' => 1024,
            'mime_type' => 'application/pdf',
            'created_at' => now(),
        ]);

        $response = $this->actingAs($this->user)->get(
            route('attachments.download', [$this->team, $this->board, $this->task, $attachment])
        );

        $response->assertOk();
        $response->assertDownload('document.pdf');
    }

    public function test_team_member_can_delete_attachment(): void
    {
        Storage::fake('local');

        $file = UploadedFile::fake()->create('document.pdf', 1024, 'application/pdf');
        $path = $file->store("attachments/{$this->task->id}", 'local');

        $attachment = Attachment::create([
            'task_id' => $this->task->id,
            'user_id' => $this->user->id,
            'filename' => 'document.pdf',
            'file_path' => $path,
            'file_size' => 1024,
            'mime_type' => 'application/pdf',
            'created_at' => now(),
        ]);

        $response = $this->actingAs($this->user)->delete(
            route('attachments.destroy', [$this->team, $this->board, $this->task, $attachment])
        );

        $response->assertRedirect();
        $this->assertDatabaseMissing('attachments', ['id' => $attachment->id]);
        Storage::disk('local')->assertMissing($path);
    }

    public function test_upload_logs_activity(): void
    {
        Storage::fake('local');

        $file = UploadedFile::fake()->create('report.xlsx', 512, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

        $this->actingAs($this->user)->post(
            route('attachments.store', [$this->team, $this->board, $this->task]),
            ['file' => $file]
        );

        $this->assertDatabaseHas('activities', [
            'task_id' => $this->task->id,
            'user_id' => $this->user->id,
            'action' => 'attachment_added',
        ]);
    }

    public function test_delete_logs_activity(): void
    {
        Storage::fake('local');

        $file = UploadedFile::fake()->create('document.pdf', 1024, 'application/pdf');
        $path = $file->store("attachments/{$this->task->id}", 'local');

        $attachment = Attachment::create([
            'task_id' => $this->task->id,
            'user_id' => $this->user->id,
            'filename' => 'document.pdf',
            'file_path' => $path,
            'file_size' => 1024,
            'mime_type' => 'application/pdf',
            'created_at' => now(),
        ]);

        $this->actingAs($this->user)->delete(
            route('attachments.destroy', [$this->team, $this->board, $this->task, $attachment])
        );

        $this->assertDatabaseHas('activities', [
            'task_id' => $this->task->id,
            'action' => 'attachment_removed',
        ]);
    }
}
