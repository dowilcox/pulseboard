<?php

namespace App\Mcp\Tools;

use App\Actions\Tasks\DeleteTask as DeleteTaskAction;
use App\Mcp\Exceptions\ToolException;
use App\Mcp\Support\Presenter;
use App\Models\User;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\Server\Attributes\Description;
use Laravel\Mcp\Server\Attributes\Name;
use Laravel\Mcp\Server\Tools\Annotations\IsDestructive;

#[Name('delete_task')]
#[Description('Permanently delete a task together with its comments, activity history and dependencies (its subtasks are kept and become top-level tasks). This cannot be undone; prefer complete_task unless the user explicitly asked for deletion. Only the task\'s creator or a team admin/owner may delete. Requires a token with the "write" ability and confirm=true.')]
#[IsDestructive]
class DeleteTask extends PulseBoardTool
{
    protected ?string $ability = 'write';

    public function schema(JsonSchema $schema): array
    {
        return [
            'task' => $schema->string()->description('Task UUID, or task number together with `board`, or "board-slug#12".')->required(),
            'board' => $schema->string()->description('Board UUID, slug, or "team-slug/board-slug". Required when `task` is a number.'),
            'team' => $schema->string()->description('Team slug or UUID; only needed when a board slug is ambiguous.'),
            'confirm' => $schema->boolean()->description('Must be true to delete.')->required(),
        ];
    }

    protected function run(Request $request, User $user): Response
    {
        $request->validate([
            'task' => ['required', 'string', 'max:255'],
            'board' => ['nullable', 'string', 'max:255'],
            'team' => ['nullable', 'string', 'max:255'],
            'confirm' => ['required', 'boolean'],
        ]);

        if (! $request->boolean('confirm')) {
            throw new ToolException('Not deleted: pass confirm=true to delete the task permanently.');
        }

        $task = $this->resolveTask($user, $request->get('task'), $request->get('board'), $request->get('team'));

        $this->authorizeFor($user, 'delete', $task, 'Only the task\'s creator or a team admin/owner can delete this task.');

        $summary = Presenter::relatedTask($task);
        unset($summary['url']);

        DeleteTaskAction::run($task);

        return $this->json(['deleted' => true, 'task' => $summary]);
    }
}
