<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Board;
use App\Models\Task;
use App\Models\Team;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class BoardTaskController extends Controller
{
    /**
     * Return paginated tasks for a board, optionally filtered by column.
     *
     * Query parameters:
     *   - column_id: filter to a single column
     *   - per_page: items per page (default 50, max 100)
     *   - page: page number
     *   - sort: sort field (sort_order, task_number, title, priority, due_date, created_at)
     *   - direction: asc|desc (default asc)
     */
    public function index(
        Request $request,
        Team $team,
        Board $board,
    ): JsonResponse {
        $this->authorize("view", $board);

        $validated = $request->validate([
            "column_id" => ["sometimes", "uuid", "exists:columns,id"],
            "per_page" => ["sometimes", "integer", "min:1", "max:100"],
            "page" => ["sometimes", "integer", "min:1"],
            "sort" => [
                "sometimes",
                "string",
                "in:sort_order,task_number,title,priority,due_date,created_at",
            ],
            "direction" => ["sometimes", "string", "in:asc,desc"],
        ]);

        $perPage = $validated["per_page"] ?? 50;
        $sort = $validated["sort"] ?? "sort_order";
        $direction = $validated["direction"] ?? "asc";

        $query = Task::where("board_id", $board->id)
            ->with([
                "assignees",
                "labels",
                "gitlabLinks.gitlabProject",
                "blockedBy:id",
            ])
            ->withCount([
                "comments",
                "subtasks",
                "subtasks as completed_subtasks_count" => function ($q) {
                    $q->whereNotNull("completed_at");
                },
            ]);

        if (isset($validated["column_id"])) {
            $query->where("column_id", $validated["column_id"]);
        }

        // Handle priority sorting with custom ordering (compatible with MySQL and SQLite)
        if ($sort === "priority") {
            $query->orderByRaw(
                "CASE priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 WHEN 'low' THEN 4 ELSE 5 END " .
                    ($direction === "desc" ? "DESC" : "ASC"),
            );
        } else {
            $query->orderBy($sort, $direction);
        }

        $paginated = $query->paginate($perPage);

        return response()->json($paginated);
    }
}
