<?php

namespace App\Mcp\Tools;

use App\Actions\Tasks\SyncTaskLabels;
use App\Mcp\Support\Presenter;
use App\Models\Label;
use App\Models\User;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\Server\Attributes\Description;
use Laravel\Mcp\Server\Attributes\Name;

#[Name('set_task_labels')]
#[Description('Change a task\'s labels using existing team labels (names or UUIDs; see get_board). mode "set" (default) replaces all labels (an empty list removes all), "add" adds, "remove" removes. Creating new labels is not available over MCP. Requires a token with the "write" ability.')]
class SetTaskLabels extends PulseBoardTool
{
    protected ?string $ability = 'write';

    public function schema(JsonSchema $schema): array
    {
        return [
            'task' => $schema->string()->description('Task UUID, or task number together with `board`, or "board-slug#12".')->required(),
            'board' => $schema->string()->description('Board UUID, slug, or "team-slug/board-slug". Required when `task` is a number.'),
            'team' => $schema->string()->description('Team slug or UUID; only needed when a board slug is ambiguous.'),
            'labels' => $schema->array()->items($schema->string())->description('Label names or UUIDs.')->required(),
            'mode' => $schema->string()->enum(['set', 'add', 'remove'])->description('Default "set".'),
        ];
    }

    protected function run(Request $request, User $user): Response
    {
        $request->validate([
            'task' => ['required', 'string', 'max:255'],
            'board' => ['nullable', 'string', 'max:255'],
            'team' => ['nullable', 'string', 'max:255'],
            'labels' => ['present', 'array', 'max:50'],
            'labels.*' => ['string', 'max:255'],
            'mode' => ['nullable', 'in:set,add,remove'],
        ]);

        $task = $this->resolveTask($user, $request->get('task'), $request->get('board'), $request->get('team'));

        $this->authorizeFor($user, 'update', $task, 'You are not allowed to update this task.');

        $ids = $this->resolveLabelIds($task->board->team, $request->get('labels'));
        $current = $task->labels()->pluck('labels.id')->all();

        $ids = match ($request->get('mode') ?? 'set') {
            'add' => array_values(array_unique([...$current, ...$ids])),
            'remove' => array_values(array_diff($current, $ids)),
            default => $ids,
        };

        $task = SyncTaskLabels::run($task, $ids);

        return $this->json([
            'labels' => $task->labels->map(fn (Label $label) => Presenter::label($label))->values()->all(),
            'task' => Presenter::relatedTask($task),
        ]);
    }
}
