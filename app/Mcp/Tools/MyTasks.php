<?php

namespace App\Mcp\Tools;

use App\Mcp\Support\Presenter;
use App\Models\Task;
use App\Models\User;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\Server\Attributes\Description;
use Laravel\Mcp\Server\Attributes\Name;
use Laravel\Mcp\Server\Tools\Annotations\IsReadOnly;

#[Name('my_tasks')]
#[Description('List tasks assigned to you across all active boards of your teams, soonest due date first (tasks without a due date last). Open tasks only by default.')]
#[IsReadOnly]
class MyTasks extends PulseBoardTool
{
    public function schema(JsonSchema $schema): array
    {
        return [
            'status' => $schema->string()->enum(['open', 'completed', 'all'])->description('Completion filter. Default "open".'),
            'team' => $schema->string()->description('Restrict to one team (slug or UUID).'),
            'limit' => $schema->integer()->min(1)->max(200)->description('Max tasks to return (default 50, max 200).'),
            'offset' => $schema->integer()->min(0)->description('Number of tasks to skip, for pagination.'),
        ];
    }

    protected function run(Request $request, User $user): Response
    {
        $request->validate([
            'status' => ['nullable', 'in:open,completed,all'],
            'team' => ['nullable', 'string', 'max:255'],
            'limit' => ['nullable', 'integer', 'min:1'],
            'offset' => ['nullable', 'integer', 'min:0'],
        ]);

        $boardIds = filled($request->get('team'))
            ? $this->resolveTeam($user, $request->get('team'))->boards()->active()->select('id')
            : $this->memberBoardIds($user, activeOnly: true);

        $query = Task::query()
            ->whereIn('board_id', $boardIds)
            ->whereHas('assignees', fn ($q) => $q->where('users.id', $user->id));

        match ($request->get('status') ?? 'open') {
            'open' => $query->whereNull('completed_at'),
            'completed' => $query->whereNotNull('completed_at'),
            default => null,
        };

        $total = (clone $query)->count();
        $limit = $this->limit($request);
        $offset = $this->offset($request);

        $tasks = $query
            ->with(Presenter::TASK_SUMMARY_RELATIONS)
            ->orderByRaw('CASE WHEN due_date IS NULL THEN 1 ELSE 0 END')
            ->orderBy('due_date')
            ->orderByDesc('updated_at')
            ->offset($offset)
            ->limit($limit)
            ->get();

        return $this->page(
            'tasks',
            $tasks->map(fn (Task $task) => Presenter::taskSummary($task))->values()->all(),
            $total,
            $offset,
            $limit,
        );
    }
}
