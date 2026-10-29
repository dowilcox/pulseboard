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

#[Name('search_tasks')]
#[Description('Search tasks across all active boards of all your teams (or one team). Matches title (case-insensitive substring), optionally the description, or an exact task number ("12" / "#12"). Exact number hits rank first, then title matches, then open tasks, then most recently updated.')]
#[IsReadOnly]
class SearchTasks extends PulseBoardTool
{
    /** task_number is an unsigned INT column. */
    private const MAX_TASK_NUMBER = 4294967295;

    public function schema(JsonSchema $schema): array
    {
        return [
            'query' => $schema->string()->description('Search text or task number.')->required(),
            'team' => $schema->string()->description('Restrict to one team (slug or UUID).'),
            'include_descriptions' => $schema->boolean()->description('Also match task descriptions. Default true.'),
            'status' => $schema->string()->enum(['open', 'completed', 'all'])->description('Completion filter. Default "all".'),
            'limit' => $schema->integer()->min(1)->max(100)->description('Max results (default 20, max 100).'),
        ];
    }

    protected function run(Request $request, User $user): Response
    {
        $request->validate([
            'query' => ['required', 'string', 'max:255'],
            'team' => ['nullable', 'string', 'max:255'],
            'include_descriptions' => ['nullable', 'boolean'],
            'status' => ['nullable', 'in:open,completed,all'],
            'limit' => ['nullable', 'integer', 'min:1'],
        ]);

        $term = trim((string) $request->get('query'));
        $like = '%'.str_replace(['!', '%', '_'], ['!!', '!%', '!_'], $term).'%';
        $taskNumber = $this->parseTaskNumber($term);
        $includeDescriptions = $request->get('include_descriptions') === null || $request->boolean('include_descriptions');
        $limit = min($this->limit($request, 20), 100);

        $boardIds = filled($request->get('team'))
            ? $this->resolveTeam($user, $request->get('team'))->boards()->active()->select('id')
            : $this->memberBoardIds($user, activeOnly: true);

        $tasks = Task::query()
            ->whereIn('board_id', $boardIds)
            ->where(function ($query) use ($like, $taskNumber, $includeDescriptions) {
                // '!' is the LIKE escape character: it behaves the same in
                // MySQL and SQLite (a backslash does not).
                $query->whereRaw("title LIKE ? ESCAPE '!'", [$like]);

                if ($includeDescriptions) {
                    $query->orWhereRaw("description LIKE ? ESCAPE '!'", [$like]);
                }

                if ($taskNumber !== null) {
                    $query->orWhere('task_number', $taskNumber);
                }
            })
            ->when($request->get('status') === 'open', fn ($q) => $q->whereNull('completed_at'))
            ->when($request->get('status') === 'completed', fn ($q) => $q->whereNotNull('completed_at'))
            ->when(
                $taskNumber !== null,
                fn ($query) => $query->orderByRaw('CASE WHEN task_number = ? THEN 0 ELSE 1 END', [$taskNumber]),
            )
            ->orderByRaw("CASE WHEN title LIKE ? ESCAPE '!' THEN 0 ELSE 1 END", [$like])
            ->orderByRaw('CASE WHEN completed_at IS NULL THEN 0 ELSE 1 END')
            ->orderByDesc('updated_at')
            ->limit($limit)
            ->with(Presenter::TASK_SUMMARY_RELATIONS)
            ->get();

        return $this->json([
            'query' => $term,
            'count' => $tasks->count(),
            'tasks' => $tasks->map(fn (Task $task) => Presenter::taskSummary($task))->values()->all(),
        ]);
    }

    private function parseTaskNumber(string $term): ?int
    {
        if (! preg_match('/^#?(\d{1,10})$/', $term, $matches)) {
            return null;
        }

        $number = (int) $matches[1];

        return $number > 0 && $number <= self::MAX_TASK_NUMBER ? $number : null;
    }
}
