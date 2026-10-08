<?php

namespace App\Http\Controllers;

use App\Models\Board;
use App\Models\Task;
use App\Models\TeamMember;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SearchController extends Controller
{
    private const LIMIT = 10;

    /** task_number is an unsigned INT column. */
    private const MAX_TASK_NUMBER = 4294967295;

    /**
     * Task search for the global quick switcher (JSON, called with axios).
     *
     * Matches task titles (case-insensitive substring) or task numbers ("12"
     * or "#12") on non-archived boards of teams the user belongs to. Exact
     * task-number hits rank first, then open tasks, then most recently updated.
     */
    public function __invoke(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'q' => ['required', 'string', 'max:100'],
        ]);

        $term = trim($validated['q']);
        $taskNumber = $this->parseTaskNumber($term);

        $boardIds = Board::active()
            ->whereIn(
                'team_id',
                TeamMember::where('user_id', $request->user()->id)->select('team_id'),
            )
            ->select('id');

        $tasks = Task::query()
            ->whereIn('board_id', $boardIds)
            ->where(function ($query) use ($term, $taskNumber) {
                // '!' is used as the LIKE escape character because it behaves
                // the same in MySQL and SQLite (a backslash does not).
                $query->whereRaw("title LIKE ? ESCAPE '!'", ['%'.$this->escapeLike($term).'%']);

                if ($taskNumber !== null) {
                    $query->orWhere('task_number', $taskNumber);
                }
            })
            ->when(
                $taskNumber !== null,
                fn ($query) => $query->orderByRaw('CASE WHEN task_number = ? THEN 0 ELSE 1 END', [$taskNumber]),
            )
            ->orderByRaw('CASE WHEN completed_at IS NULL THEN 0 ELSE 1 END')
            ->orderByDesc('updated_at')
            ->limit(self::LIMIT)
            ->with([
                'board:id,team_id,name,slug',
                'board.team:id,name,slug',
                'column:id,name',
            ])
            ->get(['id', 'board_id', 'column_id', 'task_number', 'title', 'completed_at', 'updated_at']);

        return response()->json([
            'tasks' => $tasks->map(fn (Task $task) => [
                'id' => $task->id,
                'task_number' => $task->task_number,
                'title' => $task->title,
                // Route key used in task URLs ("{number}-{title-slug}", or the id).
                'slug' => $task->getRouteKey(),
                'completed_at' => $task->completed_at?->toJSON(),
                'board' => [
                    'name' => $task->board->name,
                    'slug' => $task->board->slug,
                ],
                'team' => [
                    'name' => $task->board->team->name,
                    'slug' => $task->board->team->slug,
                ],
                'column' => $task->column ? ['name' => $task->column->name] : null,
            ])->values(),
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

    private function escapeLike(string $value): string
    {
        return str_replace(['!', '%', '_'], ['!!', '!%', '!_'], $value);
    }
}
