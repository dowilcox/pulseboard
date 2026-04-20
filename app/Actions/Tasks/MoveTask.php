<?php

namespace App\Actions\Tasks;

use App\Events\BoardChanged;
use App\Models\Board;
use App\Models\Column;
use App\Models\Task;
use App\Models\User;
use App\Services\ActivityLogger;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Lorisleiva\Actions\Concerns\AsAction;

class MoveTask
{
    use AsAction;

    public function handle(
        Task $task,
        Column $column,
        ?float $sortOrder,
        ?Board $targetBoard = null,
        ?User $actor = null,
        array $activityChanges = [],
    ): Task {
        $move = DB::transaction(fn () => $this->applyMove($task, $column, $sortOrder, $targetBoard));

        $this->recordMove($move, $actor, $activityChanges);

        return $move['task']->fresh();
    }

    public function applyMove(
        Task $task,
        Column $column,
        ?float $sortOrder,
        ?Board $targetBoard = null,
    ): array {
        $task->loadMissing('column', 'board');

        $fromColumn = $task->column;
        $fromBoard = $task->board;
        $crossBoard = $targetBoard && $targetBoard->id !== $fromBoard->id;

        if ($fromColumn->id !== $column->id && $column->wip_limit !== null && $column->wip_limit > 0) {
            Column::whereKey($column->id)->lockForUpdate()->first();
            $currentCount = Task::where('column_id', $column->id)->count();
            if ($currentCount >= $column->wip_limit) {
                throw ValidationException::withMessages([
                    'column_id' => "Column \"{$column->name}\" has reached its WIP limit of {$column->wip_limit}.",
                ]);
            }
        }

        $resolvedSortOrder = $sortOrder;

        if ($resolvedSortOrder === null) {
            $maxSort = Task::where('column_id', $column->id)->max('sort_order') ?? 0;
            $resolvedSortOrder = $maxSort + 1;
        }

        $updateData = [
            'column_id' => $column->id,
            'sort_order' => $resolvedSortOrder,
        ];

        if ($crossBoard) {
            $updateData['board_id'] = $targetBoard->id;

            $maxTaskNumber = DB::table('tasks')
                ->where('board_id', $targetBoard->id)
                ->lockForUpdate()
                ->max('task_number') ?? 0;
            $updateData['task_number'] = $maxTaskNumber + 1;
        }

        $task->update($updateData);
        $task->forceFill($updateData);

        return [
            'task' => $task,
            'column' => $column,
            'from_column' => $fromColumn,
            'from_board' => $fromBoard,
            'target_board' => $targetBoard,
            'cross_board' => $crossBoard,
            'sort_order' => $resolvedSortOrder,
        ];
    }

    public function recordMove(array $move, ?User $actor = null, array $activityChanges = []): void
    {
        /** @var Task $task */
        $task = $move['task'];
        /** @var Column $column */
        $column = $move['column'];
        /** @var Column $fromColumn */
        $fromColumn = $move['from_column'];
        /** @var Board $fromBoard */
        $fromBoard = $move['from_board'];
        /** @var Board|null $targetBoard */
        $targetBoard = $move['target_board'];
        $crossBoard = $move['cross_board'];
        $sortOrder = $move['sort_order'];
        $userId = $actor?->id ?? Auth::id() ?? 'system';

        if ($crossBoard) {
            ActivityLogger::log($task, 'moved', array_merge([
                'from_board' => $fromBoard->name,
                'to_board' => $targetBoard->name,
                'from_board_id' => $fromBoard->id,
                'to_board_id' => $targetBoard->id,
                'from_column' => $fromColumn->name,
                'to_column' => $column->name,
                'from_column_id' => $fromColumn->id,
                'to_column_id' => $column->id,
            ], $activityChanges), $actor);

            broadcast(new BoardChanged(
                boardId: $fromBoard->id,
                action: 'task.deleted',
                data: [
                    'task_id' => $task->id,
                    'task_slug' => $task->slug,
                    'to_board_slug' => $targetBoard->slug,
                ],
                userId: $userId,
            ))->toOthers();

            return;
        }

        if ($fromColumn->id !== $column->id) {
            ActivityLogger::log($task, 'moved', array_merge([
                'from_column' => $fromColumn->name,
                'to_column' => $column->name,
                'from_column_id' => $fromColumn->id,
                'to_column_id' => $column->id,
            ], $activityChanges), $actor);

            return;
        }

        broadcast(new BoardChanged(
            boardId: $task->board_id,
            action: 'task.reordered',
            data: [
                'task_id' => $task->id,
                'column_id' => $column->id,
                'sort_order' => $sortOrder,
            ],
            userId: $userId,
        ))->toOthers();
    }
}
