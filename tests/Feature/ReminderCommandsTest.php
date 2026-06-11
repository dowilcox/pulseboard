<?php

namespace Tests\Feature;

use App\Models\Task;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ReminderCommandsTest extends TestCase
{
    use RefreshDatabase;

    public function test_task_factory_creates_column_on_the_same_board(): void
    {
        $task = Task::factory()->create();

        $this->assertSame($task->board_id, $task->column->board_id);
    }

    public function test_due_soon_reminders_are_sent_once_per_assignee(): void
    {
        $user = User::factory()->create();
        // Due today: SQLite stores dates as "Y-m-d H:i:s", so "tomorrow" would
        // fall lexically outside the whereBetween upper bound in tests.
        $task = Task::factory()->create([
            'due_date' => now(),
            'completed_at' => null,
        ]);
        $task->assignees()->attach($user->id, [
            'assigned_at' => now(),
            'assigned_by' => $user->id,
        ]);

        $this->artisan('tasks:send-due-reminders')
            ->expectsOutput('Sent 1 due-soon reminders.')
            ->assertSuccessful();

        // Second run within 24h is deduplicated
        $this->artisan('tasks:send-due-reminders')
            ->expectsOutput('Sent 0 due-soon reminders.')
            ->assertSuccessful();

        $this->assertSame(1, $user->notifications()->count());
    }

    public function test_completed_tasks_are_skipped_by_reminder_commands(): void
    {
        $user = User::factory()->create();

        $dueSoon = Task::factory()->create([
            'due_date' => now(),
            'completed_at' => now(),
        ]);
        $dueSoon->assignees()->attach($user->id, [
            'assigned_at' => now(),
            'assigned_by' => $user->id,
        ]);

        $overdue = Task::factory()->create([
            'due_date' => now()->subDay(),
            'completed_at' => now(),
        ]);
        $overdue->assignees()->attach($user->id, [
            'assigned_at' => now(),
            'assigned_by' => $user->id,
        ]);

        $this->artisan('tasks:send-due-reminders')->assertSuccessful();
        $this->artisan('tasks:send-overdue-reminders')->assertSuccessful();

        $this->assertSame(0, $user->notifications()->count());
    }

    public function test_overdue_reminders_are_sent_for_open_tasks(): void
    {
        $user = User::factory()->create();
        $task = Task::factory()->create([
            'due_date' => now()->subDays(2),
            'completed_at' => null,
        ]);
        $task->assignees()->attach($user->id, [
            'assigned_at' => now(),
            'assigned_by' => $user->id,
        ]);

        $this->artisan('tasks:send-overdue-reminders')
            ->expectsOutput('Sent 1 overdue reminders.')
            ->assertSuccessful();

        $this->assertSame(1, $user->notifications()->count());
    }
}
