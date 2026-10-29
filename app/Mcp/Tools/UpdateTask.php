<?php

namespace App\Mcp\Tools;

use App\Actions\Tasks\UpdateTask as UpdateTaskAction;
use App\Mcp\Exceptions\ToolException;
use App\Mcp\Support\CustomFields;
use App\Mcp\Support\RichText;
use App\Models\User;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\Server\Attributes\Description;
use Laravel\Mcp\Server\Attributes\Name;
use Laravel\Mcp\Server\Tools\Annotations\IsIdempotent;

#[Name('update_task')]
#[Description('Update a task\'s fields. Only the fields you pass change (custom_fields is merged: only the custom fields you name change); pass null (or "") for description/due_date/effort_estimate to clear them. The description is Markdown and REPLACES the existing one (read it with get_task first if you want to append); newly @mentioned members (<@USER_ID>) are notified. To move, complete, assign, label or edit checklists use the dedicated tools. Requires a token with the "write" ability.')]
#[IsIdempotent]
class UpdateTask extends PulseBoardTool
{
    protected ?string $ability = 'write';

    public function schema(JsonSchema $schema): array
    {
        return [
            'task' => $schema->string()->description('Task UUID, or task number together with `board`, or "board-slug#12".')->required(),
            'board' => $schema->string()->description('Board UUID, slug, or "team-slug/board-slug". Required when `task` is a number.'),
            'team' => $schema->string()->description('Team slug or UUID; only needed when a board slug is ambiguous.'),
            'title' => $schema->string()->max(255)->description('New title.'),
            'description' => $schema->string()->nullable()->description('New description in Markdown (replaces the current one). Mention members with <@USER_ID>.'),
            'priority' => $schema->string()->enum(['urgent', 'high', 'medium', 'low', 'none'])->description('New priority.'),
            'due_date' => $schema->string()->nullable()->description('New due date (YYYY-MM-DD), or null to clear.'),
            'effort_estimate' => $schema->integer()->min(0)->nullable()->description('New effort estimate, or null to clear.'),
            'custom_fields' => $schema->object()->description('Custom field values keyed by field name or id (see get_board), e.g. {"Severity": "High", "Story points": 3, "Tags": ["API", "UI"]}. Select options by label or id (case-insensitive); multi-select takes a list; checkbox true/false; date YYYY-MM-DD; null clears a field.'.' Only the fields you name change.'),
        ];
    }

    protected function run(Request $request, User $user): Response
    {
        $request->validate([
            'task' => ['required', 'string', 'max:255'],
            'board' => ['nullable', 'string', 'max:255'],
            'team' => ['nullable', 'string', 'max:255'],
            'title' => ['sometimes', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:50000'],
            'priority' => ['sometimes', 'in:urgent,high,medium,low,none'],
            'due_date' => ['nullable', 'date'],
            'effort_estimate' => ['nullable', 'integer', 'min:0'],
            'custom_fields' => ['nullable', 'array', 'max:100'],
        ]);

        $task = $this->resolveTask($user, $request->get('task'), $request->get('board'), $request->get('team'));

        $this->authorizeFor($user, 'update', $task, 'You are not allowed to update this task.');

        $arguments = $request->all();
        $data = [];

        foreach (['title', 'priority'] as $field) {
            if (array_key_exists($field, $arguments)) {
                $data[$field] = $arguments[$field];
            }
        }

        if (array_key_exists('description', $arguments)) {
            $data['description'] = filled($arguments['description'])
                ? RichText::fromMarkdown($arguments['description'], $task->board->team)
                : null;
        }

        foreach (['due_date', 'effort_estimate'] as $field) {
            if (array_key_exists($field, $arguments)) {
                $data[$field] = $arguments[$field] === '' ? null : $arguments[$field];
            }
        }

        // Partial update: only the named fields change. (An explicit null
        // here is ignored rather than wiping every value.)
        if (filled($arguments['custom_fields'] ?? null)) {
            $data['custom_fields'] = CustomFields::resolveInput($task->board, $arguments['custom_fields']);
        }

        if ($data === []) {
            throw new ToolException('Nothing to update: pass at least one of title, description, priority, due_date, effort_estimate, custom_fields.');
        }

        $task = UpdateTaskAction::run($task, $data);

        return $this->json(['updated' => array_keys($data), 'task' => GetTask::present($task)]);
    }
}
