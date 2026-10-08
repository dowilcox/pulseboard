<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Board;
use App\Models\Task;
use App\Models\Team;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class BoardTaskController extends Controller
{
    /**
     * Upper bound for the unpaginated "all" mode. Boards larger than this
     * still get a response, flagged as truncated, rather than an unbounded
     * query.
     */
    public const ALL_TASKS_LIMIT = 1000;

    /**
     * Return tasks for a board, optionally filtered by column.
     *
     * Query parameters:
     *   - column_id: filter to a single column
     *   - per_page: items per page (default 50, max 100)
     *   - page: page number
     *   - sort: sort field (sort_order, task_number, title, priority, due_date, created_at)
     *   - direction: asc|desc (default asc)
     *   - all: when true, skip pagination and return up to ALL_TASKS_LIMIT
     *     tasks as {data, total, limit, truncated}. Used by the board's List
     *     and Workload views and by filtered Kanban so client-side sorting,
     *     filtering and counts cover every task, not just the loaded pages.
     */
    public function index(
        Request $request,
        Team $team,
        Board $board,
    ): JsonResponse {
        $this->authorize('view', $board);

        $validated = $request->validate([
            'column_id' => ['sometimes', 'uuid', 'exists:columns,id'],
            'per_page' => ['sometimes', 'integer', 'min:1', 'max:100'],
            'page' => ['sometimes', 'integer', 'min:1'],
            'sort' => [
                'sometimes',
                'string',
                'in:sort_order,task_number,title,priority,due_date,created_at',
            ],
            'direction' => ['sometimes', 'string', 'in:asc,desc'],
            'all' => ['sometimes', 'boolean'],
        ]);

        $perPage = $validated['per_page'] ?? 50;
        $sort = $validated['sort'] ?? 'sort_order';
        $direction = $validated['direction'] ?? 'asc';

        $query = Task::where('board_id', $board->id)
            ->when(
                isset($validated['column_id']),
                fn (Builder $q) => $q->where('column_id', $validated['column_id']),
            );

        if ($request->boolean('all')) {
            $total = (clone $query)->count();

            $tasks = $this->withCardData($query)
                ->tap(fn (Builder $q) => $this->applySort($q, $sort, $direction))
                ->orderBy('id')
                ->limit(self::ALL_TASKS_LIMIT)
                ->get();

            return response()->json([
                'data' => $tasks,
                'total' => $total,
                'limit' => self::ALL_TASKS_LIMIT,
                'truncated' => $total > $tasks->count(),
            ]);
        }

        $paginated = $this->withCardData($query)
            ->tap(fn (Builder $q) => $this->applySort($q, $sort, $direction))
            ->paginate($perPage);

        return response()->json($paginated);
    }

    /**
     * Eager-load everything a task card / list row renders.
     */
    private function withCardData(Builder $query): Builder
    {
        return $query
            ->with([
                'assignees',
                'labels',
                'gitlabProject',
                'gitlabRefs',
                'blockedBy:id',
            ])
            ->withCount([
                'comments',
                'subtasks',
                'subtasks as completed_subtasks_count' => function ($q) {
                    $q->whereNotNull('completed_at');
                },
            ]);
    }

    private function applySort(Builder $query, string $sort, string $direction): void
    {
        // Priority uses custom ordering (compatible with MySQL and SQLite)
        if ($sort === 'priority') {
            $query->orderByRaw(
                "CASE priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 WHEN 'low' THEN 4 ELSE 5 END ".
                    ($direction === 'desc' ? 'DESC' : 'ASC'),
            );

            return;
        }

        $query->orderBy($sort, $direction);
    }
}
