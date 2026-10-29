<?php

namespace App\Mcp\Tools;

use App\Actions\Tasks\UpdateTask as UpdateTaskAction;
use App\Mcp\Exceptions\ToolException;
use App\Mcp\Support\Presenter;
use App\Models\User;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Illuminate\Support\Str;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\Server\Attributes\Description;
use Laravel\Mcp\Server\Attributes\Name;

#[Name('update_checklist')]
#[Description('Edit a task\'s checklists: check or uncheck items, add items, or remove items. Items are identified by id (from get_task) or by their exact text (case-insensitive). New items go to the checklist named by `checklist` (id or title; created if it does not exist), or to the first checklist (a "Checklist" is created if the task has none). Operations are applied in the order remove, add, check, uncheck. Requires a token with the "write" ability.')]
class UpdateChecklist extends PulseBoardTool
{
    private const MAX_CHECKLISTS = 50;

    protected ?string $ability = 'write';

    public function schema(JsonSchema $schema): array
    {
        return [
            'task' => $schema->string()->description('Task UUID, or task number together with `board`, or "board-slug#12".')->required(),
            'board' => $schema->string()->description('Board UUID, slug, or "team-slug/board-slug". Required when `task` is a number.'),
            'team' => $schema->string()->description('Team slug or UUID; only needed when a board slug is ambiguous.'),
            'check' => $schema->array()->items($schema->string())->description('Item ids or texts to mark done.'),
            'uncheck' => $schema->array()->items($schema->string())->description('Item ids or texts to mark not done.'),
            'add' => $schema->array()->items($schema->string())->description('Texts of new items to add (unchecked).'),
            'remove' => $schema->array()->items($schema->string())->description('Item ids or texts to delete.'),
            'checklist' => $schema->string()->description('Checklist id or title that new items are added to.'),
        ];
    }

    protected function run(Request $request, User $user): Response
    {
        $request->validate([
            'task' => ['required', 'string', 'max:255'],
            'board' => ['nullable', 'string', 'max:255'],
            'team' => ['nullable', 'string', 'max:255'],
            'check' => ['nullable', 'array', 'max:200'],
            'check.*' => ['string', 'max:1000'],
            'uncheck' => ['nullable', 'array', 'max:200'],
            'uncheck.*' => ['string', 'max:1000'],
            'add' => ['nullable', 'array', 'max:200'],
            'add.*' => ['string', 'max:1000'],
            'remove' => ['nullable', 'array', 'max:200'],
            'remove.*' => ['string', 'max:1000'],
            'checklist' => ['nullable', 'string', 'max:255'],
        ]);

        if (blank($request->get('check')) && blank($request->get('uncheck')) && blank($request->get('add')) && blank($request->get('remove'))) {
            throw new ToolException('Nothing to do: pass at least one of check, uncheck, add, remove.');
        }

        $task = $this->resolveTask($user, $request->get('task'), $request->get('board'), $request->get('team'));

        $this->authorizeFor($user, 'update', $task, 'You are not allowed to update this task.');

        $checklists = array_values($task->checklists ?? []);

        foreach ($request->get('remove') ?? [] as $ref) {
            [$c, $i] = $this->findItem($checklists, $ref);
            array_splice($checklists[$c]['items'], $i, 1);
        }

        if (filled($request->get('add'))) {
            $target = $this->targetChecklist($checklists, $request->get('checklist'));

            foreach ($request->get('add') as $text) {
                $checklists[$target]['items'][] = [
                    'id' => (string) Str::uuid(),
                    'text' => $text,
                    'completed' => false,
                ];
            }
        }

        foreach (['check' => true, 'uncheck' => false] as $key => $completed) {
            foreach ($request->get($key) ?? [] as $ref) {
                [$c, $i] = $this->findItem($checklists, $ref);
                $checklists[$c]['items'][$i]['completed'] = $completed;
            }
        }

        $task = UpdateTaskAction::run($task, ['checklists' => $checklists]);

        return $this->json([
            'checklists' => $task->checklists,
            'progress' => $task->checklist_progress,
            'task' => Presenter::relatedTask($task->loadMissing('board.team')),
        ]);
    }

    /**
     * @return array{0: int, 1: int} checklist index and item index
     */
    private function findItem(array $checklists, string $ref): array
    {
        $ref = trim($ref);
        $matches = [];

        foreach ($checklists as $c => $checklist) {
            foreach ($checklist['items'] ?? [] as $i => $item) {
                if (($item['id'] ?? null) === $ref) {
                    return [$c, $i];
                }

                if (mb_strtolower(trim((string) ($item['text'] ?? ''))) === mb_strtolower($ref)) {
                    $matches[] = [$c, $i];
                }
            }
        }

        if (count($matches) === 1) {
            return $matches[0];
        }

        throw new ToolException(count($matches) > 1
            ? "Several checklist items have the text \"{$ref}\"; use the item id (see get_task)."
            : "Checklist item \"{$ref}\" was not found. Use get_task to see checklist item ids.");
    }

    private function targetChecklist(array &$checklists, ?string $ref): int
    {
        $ref = trim((string) $ref);

        foreach ($checklists as $index => $checklist) {
            if ($ref === '' || ($checklist['id'] ?? null) === $ref
                || mb_strtolower((string) ($checklist['title'] ?? '')) === mb_strtolower($ref)) {
                $checklists[$index]['items'] ??= [];

                return $index;
            }
        }

        if (count($checklists) >= self::MAX_CHECKLISTS) {
            throw new ToolException('This task already has the maximum number of checklists.');
        }

        $checklists[] = [
            'id' => (string) Str::uuid(),
            'title' => $ref !== '' ? Str::limit($ref, 255, '') : 'Checklist',
            'items' => [],
        ];

        return array_key_last($checklists);
    }
}
