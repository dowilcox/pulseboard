<?php

namespace App\Mcp\Tools;

use App\Mcp\Support\Presenter;
use App\Models\Column;
use App\Models\Task;
use App\Models\User;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Illuminate\Support\Carbon;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\Server\Attributes\Description;
use Laravel\Mcp\Server\Attributes\Name;
use Laravel\Mcp\Server\Tools\Annotations\IsReadOnly;

#[Name('list_tasks')]
#[Description('List tasks on a board, in board order (column by column, top to bottom) unless `sort` is given. Filters can be combined. By default only open (not completed) tasks are returned. Results are paginated with limit/offset; check has_more/next_offset. Use get_task for full details of a single task.')]
#[IsReadOnly]
class ListTasks extends PulseBoardTool
{
    public function schema(JsonSchema $schema): array
    {
        return [
            'board' => $schema->string()->description('Board UUID, slug, or "team-slug/board-slug".')->required(),
            'team' => $schema->string()->description('Team slug or UUID; only needed when a board slug is ambiguous.'),
            'column' => $schema->string()->description('Only tasks in this column (column UUID or name).'),
            'assignee' => $schema->string()->description('Only tasks assigned to this user: "me", a user UUID, an email, or "none" for unassigned tasks.'),
            'label' => $schema->string()->description('Only tasks with this label (label UUID or name).'),
            'priority' => $schema->string()->enum(['urgent', 'high', 'medium', 'low', 'none'])->description('Only tasks with this priority.'),
            'status' => $schema->string()->enum(['open', 'completed', 'all'])->description('Completion filter. Default "open".'),
            'due_before' => $schema->string()->description('Only tasks due on or before this date (YYYY-MM-DD).'),
            'due_after' => $schema->string()->description('Only tasks due on or after this date (YYYY-MM-DD).'),
            'query' => $schema->string()->description('Case-insensitive text match on title and description, or an exact task number ("12" / "#12").'),
            'parent' => $schema->string()->description('Only subtasks of this task (task UUID or number on this board). Use "none" for top-level tasks only.'),
            'sort' => $schema->string()->enum(['board', 'priority', 'due_date', 'updated_at', 'created_at', 'task_number'])->description('Sort order. Default "board" (column order, then card order).'),
            'limit' => $schema->integer()->min(1)->max(200)->description('Max tasks to return (default 50, max 200).'),
            'offset' => $schema->integer()->min(0)->description('Number of tasks to skip, for pagination.'),
        ];
    }

    protected function run(Request $request, User $user): Response
    {
        $request->validate([
            'board' => ['required', 'string', 'max:255'],
            'team' => ['nullable', 'string', 'max:255'],
            'column' => ['nullable', 'string', 'max:255'],
            'assignee' => ['nullable', 'string', 'max:255'],
            'label' => ['nullable', 'string', 'max:255'],
            'priority' => ['nullable', 'in:urgent,high,medium,low,none'],
            'status' => ['nullable', 'in:open,completed,all'],
            'due_before' => ['nullable', 'date'],
            'due_after' => ['nullable', 'date'],
            'query' => ['nullable', 'string', 'max:255'],
            'parent' => ['nullable', 'string', 'max:255'],
            'sort' => ['nullable', 'in:board,priority,due_date,updated_at,created_at,task_number'],
            'limit' => ['nullable', 'integer', 'min:1'],
            'offset' => ['nullable', 'integer', 'min:0'],
        ]);

        $board = $this->resolveBoard($user, $request->get('board'), $request->get('team'));
        $team = $board->team;

        $query = Task::query()->where('tasks.board_id', $board->id);

        if (filled($request->get('column'))) {
            $query->where('tasks.column_id', $this->resolveColumn($board, $request->get('column'))->id);
        }

        if (filled($assignee = $request->get('assignee'))) {
            if (mb_strtolower(trim($assignee)) === 'none') {
                $query->whereDoesntHave('assignees');
            } else {
                $assigneeId = $this->resolveMemberIds($user, $team, [$assignee])[0];
                $query->whereHas('assignees', fn ($q) => $q->where('users.id', $assigneeId));
            }
        }

        if (filled($request->get('label'))) {
            $labelId = $this->resolveLabelIds($team, [$request->get('label')])[0];
            $query->whereHas('labels', fn ($q) => $q->where('labels.id', $labelId));
        }

        if (filled($request->get('priority'))) {
            $query->where('tasks.priority', $request->get('priority'));
        }

        match ($request->get('status') ?? 'open') {
            'open' => $query->whereNull('tasks.completed_at'),
            'completed' => $query->whereNotNull('tasks.completed_at'),
            default => null,
        };

        if (filled($request->get('due_before'))) {
            $query->whereDate('tasks.due_date', '<=', Carbon::parse($request->get('due_before'))->toDateString());
        }

        if (filled($request->get('due_after'))) {
            $query->whereDate('tasks.due_date', '>=', Carbon::parse($request->get('due_after'))->toDateString());
        }

        if (filled($text = trim((string) $request->get('query')))) {
            $query->where(function ($sub) use ($text) {
                $like = '%'.str_replace(['!', '%', '_'], ['!!', '!%', '!_'], $text).'%';
                $sub->whereRaw("tasks.title LIKE ? ESCAPE '!'", [$like])
                    ->orWhereRaw("tasks.description LIKE ? ESCAPE '!'", [$like]);

                if (preg_match('/^#?(\d{1,10})$/', $text, $m) && (int) $m[1] > 0) {
                    $sub->orWhere('tasks.task_number', (int) $m[1]);
                }
            });
        }

        if (filled($parent = $request->get('parent'))) {
            if (mb_strtolower(trim($parent)) === 'none') {
                $query->whereNull('tasks.parent_task_id');
            } else {
                $query->where('tasks.parent_task_id', $this->resolveTask($user, $parent, $board->id)->id);
            }
        }

        $total = (clone $query)->count();
        $limit = $this->limit($request);
        $offset = $this->offset($request);

        $this->applySort($query, $request->get('sort') ?? 'board');

        $tasks = $query
            ->with(Presenter::TASK_SUMMARY_RELATIONS)
            ->withCount([
                'comments',
                'subtasks',
                'subtasks as completed_subtasks_count' => fn ($q) => $q->whereNotNull('completed_at'),
            ])
            ->offset($offset)
            ->limit($limit)
            ->get(['tasks.*']);

        return $this->page(
            'tasks',
            $tasks->map(fn (Task $task) => Presenter::taskSummary($task))->values()->all(),
            $total,
            $offset,
            $limit,
            ['board' => Presenter::board($board, $team)],
        );
    }

    private function applySort($query, string $sort): void
    {
        match ($sort) {
            'priority' => $query
                ->orderByRaw("CASE tasks.priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 WHEN 'low' THEN 4 ELSE 5 END")
                ->orderBy('tasks.sort_order'),
            // Tasks without a due date go last.
            'due_date' => $query->orderByRaw('CASE WHEN tasks.due_date IS NULL THEN 1 ELSE 0 END')
                ->orderBy('tasks.due_date')
                ->orderBy('tasks.task_number'),
            'updated_at' => $query->orderByDesc('tasks.updated_at'),
            'created_at' => $query->orderByDesc('tasks.created_at'),
            'task_number' => $query->orderBy('tasks.task_number'),
            default => $query
                ->orderBy(Column::query()->select('sort_order')->whereColumn('columns.id', 'tasks.column_id'))
                ->orderBy('tasks.sort_order')
                ->orderBy('tasks.task_number'),
        };
    }
}
