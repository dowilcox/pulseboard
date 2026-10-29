<?php

namespace Tests\Feature\Mcp\Concerns;

use App\Mcp\Servers\PulseBoardServer;
use App\Models\Board;
use App\Models\Column;
use App\Models\Task;
use App\Models\Team;
use App\Models\TeamMember;
use App\Models\User;
use Laravel\Mcp\Server\Testing\TestResponse;
use Laravel\Sanctum\Sanctum;

trait InteractsWithMcp
{
    protected function memberOf(Team $team, string $role = 'member', array $attributes = []): User
    {
        $user = User::factory()->create($attributes);
        TeamMember::create(['team_id' => $team->id, 'user_id' => $user->id, 'role' => $role]);

        return $user;
    }

    /**
     * Call a tool as $user with a Sanctum token carrying $abilities.
     */
    protected function callTool(User $user, string $tool, array $arguments = [], array $abilities = ['read', 'write']): TestResponse
    {
        Sanctum::actingAs($user, $abilities);

        return PulseBoardServer::tool($tool, $arguments);
    }

    /**
     * Decode the JSON text content of a successful tool response.
     */
    protected function toolJson(TestResponse $response): array
    {
        $response->assertOk();

        $result = (fn () => $this->response->toArray())->call($response)['result'];
        $text = $result['content'][0]['text'] ?? '';

        return json_decode($text, true, flags: JSON_THROW_ON_ERROR);
    }

    protected function makeTask(Board $board, Column $column, User $creator, array $attributes = []): Task
    {
        return Task::factory()->create([
            'board_id' => $board->id,
            'column_id' => $column->id,
            'created_by' => $creator->id,
            'task_number' => (Task::where('board_id', $board->id)->max('task_number') ?? 0) + 1,
            'priority' => 'none',
            'due_date' => null,
            'description' => null,
            ...$attributes,
        ]);
    }
}
