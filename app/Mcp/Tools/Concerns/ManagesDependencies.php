<?php

namespace App\Mcp\Tools\Concerns;

use App\Mcp\Exceptions\ToolException;
use App\Models\Task;
use App\Models\User;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Laravel\Mcp\Request;

/**
 * Shared argument handling for add_dependency / remove_dependency.
 */
trait ManagesDependencies
{
    protected function dependencySchema(JsonSchema $schema): array
    {
        return [
            'task' => $schema->string()->description('The dependent (blocked) task: UUID, number together with `board`, or "board-slug#12".')->required(),
            'board' => $schema->string()->description('Board of `task` (UUID, slug, or "team-slug/board-slug"). Required when `task` is a number.'),
            'team' => $schema->string()->description('Team slug or UUID; only needed when a board slug is ambiguous.'),
            'depends_on' => $schema->string()->description('The blocking task that must be finished first: UUID, a number on the same board, or "other-board-slug#12" for a task on another board of the same team.')->required(),
        ];
    }

    /**
     * @return array{0: Task, 1: Task}
     */
    protected function resolveDependencyPair(Request $request, User $user): array
    {
        $request->validate([
            'task' => ['required', 'string', 'max:255'],
            'board' => ['nullable', 'string', 'max:255'],
            'team' => ['nullable', 'string', 'max:255'],
            'depends_on' => ['required', 'string', 'max:255'],
        ]);

        $task = $this->resolveTask($user, $request->get('task'), $request->get('board'), $request->get('team'));

        $this->authorizeFor($user, 'update', $task, 'You are not allowed to update this task.');

        // A bare number refers to the task's own board; "board#12" may name
        // another board of the same team.
        $ref = trim((string) $request->get('depends_on'));
        $boardRef = str_contains($ref, '#') ? null : $task->board_id;
        $dependsOn = $this->resolveTask($user, $ref, $boardRef, $task->board->team_id);

        if ($dependsOn->board->team_id !== $task->board->team_id) {
            throw new ToolException('The dependency task must belong to the same team.');
        }

        if ($dependsOn->id === $task->id) {
            throw new ToolException('A task cannot depend on itself.');
        }

        return [$task, $dependsOn];
    }
}
