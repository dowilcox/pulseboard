<?php

namespace App\Mcp\Tools;

use App\Actions\Tasks\CreateTask as CreateTaskAction;
use App\Actions\Tasks\UpdateTask;
use App\Mcp\Exceptions\ToolException;
use App\Mcp\Support\CustomFields;
use App\Mcp\Support\RichText;
use App\Models\Task;
use App\Models\User;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Illuminate\Support\Str;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\Server\Attributes\Description;
use Laravel\Mcp\Server\Attributes\Name;

#[Name('create_task')]
#[Description('Create a task on a board, exactly as if created in the web UI (activity log, real-time board update, automations). Defaults: first column, priority "none", the board\'s default task template if one is set. Pass `parent_task` to create a subtask and `custom_fields` to fill the board\'s custom fields. The description is Markdown; mention a team member with <@USER_ID> (ids from get_board). Requires a token with the "write" ability. Returns the created task.')]
class CreateTask extends PulseBoardTool
{
    protected ?string $ability = 'write';

    public function schema(JsonSchema $schema): array
    {
        return [
            'board' => $schema->string()->description('Board UUID, slug, or "team-slug/board-slug".')->required(),
            'team' => $schema->string()->description('Team slug or UUID; only needed when a board slug is ambiguous.'),
            'title' => $schema->string()->max(255)->description('Task title.')->required(),
            'description' => $schema->string()->description('Task description in Markdown (GitHub-flavoured: headings, lists, task lists, code blocks, tables, links). Mention members with <@USER_ID>.'),
            'column' => $schema->string()->description('Column UUID or name. Default: the board\'s first column.'),
            'priority' => $schema->string()->enum(['urgent', 'high', 'medium', 'low', 'none'])->description('Priority. Default "none".'),
            'due_date' => $schema->string()->description('Due date, YYYY-MM-DD.'),
            'effort_estimate' => $schema->integer()->min(0)->description('Effort estimate (team-defined units, e.g. points or hours).'),
            'assignees' => $schema->array()->items($schema->string())->description('Users to assign: "me", user UUIDs, or emails of active team members.'),
            'labels' => $schema->array()->items($schema->string())->description('Label names or UUIDs (team labels; see get_board).'),
            'parent_task' => $schema->string()->description('Make this a subtask of the given task on the same board (task UUID or number).'),
            'custom_fields' => $schema->object()->description('Custom field values keyed by field name or id (see get_board), e.g. {"Severity": "High", "Story points": 3, "Tags": ["API", "UI"]}. Select options by label or id (case-insensitive); multi-select takes a list; checkbox true/false; date YYYY-MM-DD; null clears a field.'),
            'checklist' => $schema->array()->items($schema->string())->description('Checklist item texts to add as a checklist.'),
            'checklist_title' => $schema->string()->description('Title for the checklist (default "Checklist").'),
        ];
    }

    protected function run(Request $request, User $user): Response
    {
        $request->validate([
            'board' => ['required', 'string', 'max:255'],
            'team' => ['nullable', 'string', 'max:255'],
            'title' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:50000'],
            'column' => ['nullable', 'string', 'max:255'],
            'priority' => ['nullable', 'in:urgent,high,medium,low,none'],
            'due_date' => ['nullable', 'date'],
            'effort_estimate' => ['nullable', 'integer', 'min:0'],
            'assignees' => ['nullable', 'array', 'max:50'],
            'assignees.*' => ['string', 'max:255'],
            'labels' => ['nullable', 'array', 'max:50'],
            'labels.*' => ['string', 'max:255'],
            'parent_task' => ['nullable', 'string', 'max:255'],
            'custom_fields' => ['nullable', 'array', 'max:100'],
            'checklist' => ['nullable', 'array', 'max:100'],
            'checklist.*' => ['string', 'max:1000'],
            'checklist_title' => ['nullable', 'string', 'max:255'],
        ]);

        $board = $this->resolveBoard($user, $request->get('board'), $request->get('team'));
        $team = $board->team;

        if ($board->is_archived) {
            throw new ToolException("Board \"{$board->slug}\" is archived; tasks cannot be added to it.");
        }

        $this->authorizeFor($user, 'create', [Task::class, $board], 'You are not allowed to create tasks on this board.');

        $column = $this->resolveColumn($board, $request->get('column'));

        // Only pass keys the caller provided so the board's default task
        // template still fills the rest (same as StoreTaskRequest::validated()).
        $data = ['title' => $request->get('title')];

        if ($request->get('description') !== null) {
            $data['description'] = RichText::fromMarkdown($request->get('description'), $team);
        }

        foreach (['priority', 'due_date', 'effort_estimate'] as $field) {
            if ($request->get($field) !== null) {
                $data[$field] = $request->get($field);
            }
        }

        if (filled($request->get('assignees'))) {
            $data['assignee_ids'] = $this->resolveMemberIds($user, $team, $request->get('assignees'));
        }

        if (filled($request->get('labels'))) {
            $data['label_ids'] = $this->resolveLabelIds($team, $request->get('labels'));
        }

        if (filled($request->get('parent_task'))) {
            $parent = $this->resolveTask($user, $request->get('parent_task'), $board->id);

            if ($parent->board_id !== $board->id) {
                throw new ToolException('The parent task must be on the same board.');
            }

            $data['parent_task_id'] = $parent->id;
        }

        if (filled($request->get('custom_fields'))) {
            $data['custom_fields'] = CustomFields::resolveInput($board, $request->get('custom_fields'));
        }

        $task = CreateTaskAction::run($board, $column, $data, $user);

        if (filled($request->get('checklist'))) {
            $task = UpdateTask::run($task, [
                'checklists' => [[
                    'id' => (string) Str::uuid(),
                    'title' => $request->get('checklist_title') ?: 'Checklist',
                    'items' => collect($request->get('checklist'))
                        ->map(fn (string $text) => [
                            'id' => (string) Str::uuid(),
                            'text' => $text,
                            'completed' => false,
                        ])->values()->all(),
                ]],
            ]);
        }

        return $this->json(['created' => true, 'task' => GetTask::present($task->fresh())]);
    }
}
