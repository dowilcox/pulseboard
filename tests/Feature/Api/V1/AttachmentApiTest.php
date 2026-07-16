<?php

namespace Tests\Feature\Api\V1;

use App\Models\Board;
use App\Models\Column;
use App\Models\Task;
use App\Models\Team;
use App\Models\TeamMember;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Spatie\MediaLibrary\MediaCollections\Models\Media;
use Tests\TestCase;

class AttachmentApiTest extends TestCase
{
    use RefreshDatabase;

    private User $user;

    private Team $team;

    private Board $board;

    private Column $column;

    private Task $task;

    private string $token;

    protected function setUp(): void
    {
        parent::setUp();

        $this->user = User::factory()->create();
        $this->team = Team::factory()->create();
        TeamMember::create(['team_id' => $this->team->id, 'user_id' => $this->user->id, 'role' => 'owner']);
        $this->board = Board::factory()->create(['team_id' => $this->team->id]);
        $this->column = Column::factory()->create(['board_id' => $this->board->id]);
        $this->task = Task::factory()->create([
            'board_id' => $this->board->id,
            'column_id' => $this->column->id,
            'created_by' => $this->user->id,
        ]);
        $this->token = $this->user->createToken('test', ['read', 'write'])->plainTextToken;
    }

    private function api(?string $token = null): static
    {
        return $this->withHeader('Authorization', 'Bearer '.($token ?? $this->token));
    }

    private function baseUrl(?Task $task = null): string
    {
        $task ??= $this->task;

        return "/api/v1/teams/{$this->team->id}/boards/{$this->board->id}/tasks/{$task->id}/attachments";
    }

    private function addAttachment(Task $task, UploadedFile $file): Media
    {
        return $task->addMedia($file)
            ->withCustomProperties([
                'original_filename' => $file->getClientOriginalName(),
                'uploaded_by' => $this->user->id,
            ])
            ->toMediaCollection('attachments');
    }

    public function test_upload_attachment(): void
    {
        Storage::fake('local');

        $file = UploadedFile::fake()->create('document.pdf', 1024, 'application/pdf');

        $response = $this->api()->post($this->baseUrl(), ['file' => $file], ['Accept' => 'application/json']);

        $response->assertCreated();
        $response->assertJsonPath('data.filename', 'document.pdf');
        $response->assertJsonPath('data.task_id', $this->task->id);
        $response->assertJsonPath('data.user.id', $this->user->id);
        $response->assertJsonStructure(['data' => ['id', 'task_id', 'user_id', 'filename', 'file_size', 'mime_type', 'thumbnail_url', 'created_at', 'user']]);

        $media = $this->task->getMedia('attachments');
        $this->assertCount(1, $media);
        $this->assertEquals('document.pdf', $media->first()->getCustomProperty('original_filename'));
        $this->assertEquals($this->user->id, $media->first()->getCustomProperty('uploaded_by'));
        $this->assertEquals($media->first()->uuid, $response->json('data.id'));
        $this->assertEquals($media->first()->mime_type, $response->json('data.mime_type'));
    }

    public function test_upload_logs_activity(): void
    {
        Storage::fake('local');

        $file = UploadedFile::fake()->create('report.xlsx', 512, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

        $this->api()->post($this->baseUrl(), ['file' => $file], ['Accept' => 'application/json']);

        $this->assertDatabaseHas('activities', [
            'task_id' => $this->task->id,
            'user_id' => $this->user->id,
            'action' => 'attachment_added',
        ]);
    }

    public function test_upload_requires_file(): void
    {
        $response = $this->api()->post($this->baseUrl(), [], ['Accept' => 'application/json']);

        $response->assertUnprocessable();
        $response->assertJsonValidationErrors('file');
    }

    public function test_upload_rejects_file_over_15mb(): void
    {
        Storage::fake('local');

        $file = UploadedFile::fake()->create('large.zip', 16000, 'application/zip');

        $response = $this->api()->post($this->baseUrl(), ['file' => $file], ['Accept' => 'application/json']);

        $response->assertUnprocessable();
        $response->assertJsonValidationErrors('file');
        $this->assertCount(0, $this->task->getMedia('attachments'));
    }

    public function test_upload_rejects_disallowed_file_type(): void
    {
        Storage::fake('local');

        $file = UploadedFile::fake()->create('script.exe', 64, 'application/x-msdownload');

        $response = $this->api()->post($this->baseUrl(), ['file' => $file], ['Accept' => 'application/json']);

        $response->assertUnprocessable();
        $response->assertJsonValidationErrors('file');
        $this->assertCount(0, $this->task->getMedia('attachments'));
    }

    public function test_upload_rejects_spoofed_extension_with_wrong_mime(): void
    {
        Storage::fake('local');

        $tempPath = tempnam(sys_get_temp_dir(), 'pulseboard-test-');
        file_put_contents($tempPath, "<?php phpinfo(); ?>\n");

        $file = new UploadedFile($tempPath, 'shell.jpg', 'image/jpeg', null, true);

        $response = $this->api()->post($this->baseUrl(), ['file' => $file], ['Accept' => 'application/json']);

        $response->assertUnprocessable();
        $response->assertJsonValidationErrors('file');
        $this->assertCount(0, $this->task->getMedia('attachments'));
    }

    public function test_upload_requires_write_ability(): void
    {
        Storage::fake('local');

        $readToken = $this->user->createToken('read-only', ['read'])->plainTextToken;
        $file = UploadedFile::fake()->create('document.pdf', 1024, 'application/pdf');

        $response = $this->api($readToken)->post($this->baseUrl(), ['file' => $file], ['Accept' => 'application/json']);

        $response->assertForbidden();
        $this->assertCount(0, $this->task->getMedia('attachments'));
    }

    public function test_list_attachments(): void
    {
        Storage::fake('local');

        $media = $this->addAttachment($this->task, UploadedFile::fake()->create('document.pdf', 1024, 'application/pdf'));
        $this->addAttachment($this->task, UploadedFile::fake()->create('notes.txt', 4, 'text/plain'));

        $response = $this->api()->getJson($this->baseUrl());

        $response->assertOk();
        $response->assertJsonCount(2, 'data');
        $response->assertJsonStructure(['data' => [['id', 'task_id', 'user_id', 'filename', 'file_size', 'mime_type', 'thumbnail_url', 'created_at', 'user']]]);
        $this->assertContains($media->uuid, $response->json('data.*.id'));
    }

    public function test_list_attachments_empty(): void
    {
        $response = $this->api()->getJson($this->baseUrl());

        $response->assertOk();
        $response->assertJsonCount(0, 'data');
    }

    public function test_download_attachment(): void
    {
        Storage::fake('local');

        $file = UploadedFile::fake()->createWithContent('notes.txt', 'hello from pulseboard');
        $media = $this->addAttachment($this->task, $file);

        $response = $this->api()->get($this->baseUrl()."/{$media->uuid}/download");

        $response->assertOk();
        $response->assertHeader('Content-Type', 'text/plain; charset=utf-8');
        $this->assertStringContainsString('notes.txt', $response->headers->get('Content-Disposition'));
        $this->assertStringContainsString('attachment', $response->headers->get('Content-Disposition'));
        $this->assertEquals('hello from pulseboard', $response->streamedContent());
    }

    public function test_download_media_on_another_task_returns_404(): void
    {
        Storage::fake('local');

        $otherTask = Task::factory()->create([
            'board_id' => $this->board->id,
            'column_id' => $this->column->id,
            'created_by' => $this->user->id,
        ]);
        $media = $this->addAttachment($otherTask, UploadedFile::fake()->create('document.pdf', 1024, 'application/pdf'));

        $response = $this->api()->get($this->baseUrl()."/{$media->uuid}/download");

        $response->assertNotFound();
    }

    public function test_delete_attachment(): void
    {
        Storage::fake('local');

        $media = $this->addAttachment($this->task, UploadedFile::fake()->create('document.pdf', 1024, 'application/pdf'));

        $response = $this->api()->deleteJson($this->baseUrl()."/{$media->uuid}");

        $response->assertNoContent();
        $this->assertDatabaseMissing('media', ['id' => $media->id]);
        $this->assertDatabaseHas('activities', [
            'task_id' => $this->task->id,
            'action' => 'attachment_removed',
        ]);
    }

    public function test_delete_media_on_another_task_returns_404(): void
    {
        Storage::fake('local');

        $otherTask = Task::factory()->create([
            'board_id' => $this->board->id,
            'column_id' => $this->column->id,
            'created_by' => $this->user->id,
        ]);
        $media = $this->addAttachment($otherTask, UploadedFile::fake()->create('document.pdf', 1024, 'application/pdf'));

        $response = $this->api()->deleteJson($this->baseUrl()."/{$media->uuid}");

        $response->assertNotFound();
        $this->assertDatabaseHas('media', ['id' => $media->id]);
    }

    public function test_delete_requires_write_ability(): void
    {
        Storage::fake('local');

        $readToken = $this->user->createToken('read-only', ['read'])->plainTextToken;
        $media = $this->addAttachment($this->task, UploadedFile::fake()->create('document.pdf', 1024, 'application/pdf'));

        $response = $this->api($readToken)->deleteJson($this->baseUrl()."/{$media->uuid}");

        $response->assertForbidden();
        $this->assertDatabaseHas('media', ['id' => $media->id]);
    }
}
