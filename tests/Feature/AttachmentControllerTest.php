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

        $media = $this->task->getMedia('attachments');
        $this->assertCount(1, $media);
        $this->assertEquals('document.pdf', $media->first()->getCustomProperty('original_filename'));
        $this->assertEquals($this->user->id, $media->first()->getCustomProperty('uploaded_by'));
    }

    public function test_upload_requires_file(): void
    {
        $response = $this->actingAs($this->user)->post(
            route('attachments.store', [$this->team, $this->board, $this->task]),
            []
        );

        $response->assertSessionHasErrors('file');
    }

    public function test_upload_rejects_file_over_15mb(): void
    {
        Storage::fake('local');

        $file = UploadedFile::fake()->create('large.zip', 16000, 'application/zip');

        $response = $this->actingAs($this->user)->post(
            route('attachments.store', [$this->team, $this->board, $this->task]),
            ['file' => $file]
        );

        $response->assertSessionHasErrors('file');
    }

    public function test_upload_rejects_php_payload_masquerading_as_image(): void
    {
        Storage::fake('local');

        $tempPath = tempnam(sys_get_temp_dir(), 'pulseboard-test-');
        file_put_contents($tempPath, "<?php phpinfo(); ?>\n");

        $file = new UploadedFile(
            $tempPath,
            'shell.jpg',
            'image/jpeg',
            null,
            true
        );

        $response = $this->actingAs($this->user)->post(
            route('attachments.store', [$this->team, $this->board, $this->task]),
            ['file' => $file]
        );

        $response->assertSessionHasErrors('file');
        $this->assertCount(0, $this->task->getMedia('attachments'));
    }

    public function test_upload_rejects_spoofed_extension_with_wrong_mime(): void
    {
        Storage::fake('local');

        $file = UploadedFile::fake()->create('fake.jpg', 32, 'application/x-php');

        $response = $this->actingAs($this->user)->post(
            route('attachments.store', [$this->team, $this->board, $this->task]),
            ['file' => $file]
        );

        $response->assertSessionHasErrors('file');
        $this->assertCount(0, $this->task->getMedia('attachments'));
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

        $media = $this->task->addMedia($file)
            ->withCustomProperties([
                'original_filename' => 'document.pdf',
                'uploaded_by' => $this->user->id,
            ])
            ->toMediaCollection('attachments');

        $response = $this->actingAs($this->user)->get(
            route('attachments.download', [$this->team, $this->board, $this->task, $media->uuid])
        );

        $response->assertOk();
    }

    public function test_team_member_can_delete_attachment(): void
    {
        Storage::fake('local');

        $file = UploadedFile::fake()->create('document.pdf', 1024, 'application/pdf');

        $media = $this->task->addMedia($file)
            ->withCustomProperties([
                'original_filename' => 'document.pdf',
                'uploaded_by' => $this->user->id,
            ])
            ->toMediaCollection('attachments');

        $response = $this->actingAs($this->user)->delete(
            route('attachments.destroy', [$this->team, $this->board, $this->task, $media->uuid])
        );

        $response->assertRedirect();
        $this->assertDatabaseMissing('media', ['id' => $media->id]);
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

        $media = $this->task->addMedia($file)
            ->withCustomProperties([
                'original_filename' => 'document.pdf',
                'uploaded_by' => $this->user->id,
            ])
            ->toMediaCollection('attachments');

        $this->actingAs($this->user)->delete(
            route('attachments.destroy', [$this->team, $this->board, $this->task, $media->uuid])
        );

        $this->assertDatabaseHas('activities', [
            'task_id' => $this->task->id,
            'action' => 'attachment_removed',
        ]);
    }
}
