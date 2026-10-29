<?php

namespace App\Mcp\Tools;

use App\Actions\Tasks\ToggleTaskCompletion;
use App\Mcp\Support\Presenter;
use App\Models\User;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\Server\Attributes\Description;
use Laravel\Mcp\Server\Attributes\Name;
use Laravel\Mcp\Server\Tools\Annotations\IsIdempotent;

#[Name('complete_task')]
#[Description('Mark a task completed (default) or reopen it with completed=false. Idempotent: a task already in the requested state is left unchanged. If the board has "auto move to done" enabled, completing also moves the card to the done column. Requires a token with the "write" ability.')]
#[IsIdempotent]
class CompleteTask extends PulseBoardTool
{
    protected ?string $ability = 'write';

    public function schema(JsonSchema $schema): array
    {
        return [
            'task' => $schema->string()->description('Task UUID, or task number together with `board`, or "board-slug#12".')->required(),
            'board' => $schema->string()->description('Board UUID, slug, or "team-slug/board-slug". Required when `task` is a number.'),
            'team' => $schema->string()->description('Team slug or UUID; only needed when a board slug is ambiguous.'),
            'completed' => $schema->boolean()->description('true to complete (default), false to reopen.'),
        ];
    }

    protected function run(Request $request, User $user): Response
    {
        $request->validate([
            'task' => ['required', 'string', 'max:255'],
            'board' => ['nullable', 'string', 'max:255'],
            'team' => ['nullable', 'string', 'max:255'],
            'completed' => ['nullable', 'boolean'],
        ]);

        $task = $this->resolveTask($user, $request->get('task'), $request->get('board'), $request->get('team'));

        $this->authorizeFor($user, 'update', $task, 'You are not allowed to update this task.');

        $target = $request->get('completed') === null || $request->boolean('completed');
        $changed = $target !== ($task->completed_at !== null);

        if ($changed) {
            $task = ToggleTaskCompletion::run($task, $user);
        }

        $task->load(Presenter::TASK_SUMMARY_RELATIONS);

        return $this->json([
            'changed' => $changed,
            'completed' => $task->completed_at !== null,
            'task' => Presenter::taskSummary($task),
        ]);
    }
}
