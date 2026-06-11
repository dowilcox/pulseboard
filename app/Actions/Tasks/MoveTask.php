<?php

namespace App\Actions\Tasks;

use App\Actions\Tasks\Concerns\ManagesTaskPlacement;
use App\Events\BoardChanged;
use App\Models\Board;
use App\Models\Column;
use App\Models\Task;
use App\Models\Team;
use App\Models\User;
use App\Services\ActivityLogger;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Lorisleiva\Actions\Concerns\AsAction;

class MoveTask
{
    use AsAction;
    use ManagesTaskPlacement;

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

    /**
     * Resolve the destination board and column for a move request, scoped to
     * the team/board from the route. Returns the target board (null when the
     * task stays on its current board) and the destination column; 404s when
     * either does not belong to the team. Callers must still authorize the
     * returned target board.
     *
     * @return array{0: Board|null, 1: Column}
     */
    public function resolveTarget(
        Team $team,
        Board $board,
        ?string $targetBoardId,
        string $columnId,
    ): array {
        if ($targetBoardId && $targetBoardId !== $board->id) {
            // Cross-board move: validate target board belongs to same team
            $targetBoard = $team->boards()->active()->findOrFail($targetBoardId);

            return [$targetBoard, $targetBoard->columns()->findOrFail($columnId)];
        }

        return [null, $board->columns()->findOrFail($columnId)];
    }

    public function applyMove(
        Task $task,
        Column $column,
        ?float $sortOrder,
        ?Board $targetBoard = null,
        bool $syncCompletion = true,
    ): array {
        $task->loadMissing('column', 'board');

        $fromColumn = $task->column;
        $fromBoard = $task->board;
        $crossBoard = $targetBoard && $targetBoard->id !== $fromBoard->id;

        if ($fromColumn->id !== $column->id) {
            $this->assertWipCapacity($column);
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
            $updateData['task_number'] = $this->nextTaskNumber($targetBoard);
        }

        // Keep completed_at in sync with done columns, mirroring
        // ToggleTaskCompletion (which manages the timestamp itself and
        // passes $syncCompletion = false to avoid double-handling).
        $completionChange = null;

        if ($syncCompletion && $fromColumn->id !== $column->id) {
            if ($column->is_done_column && $task->completed_at === null) {
                $updateData['completed_at'] = now();
                $completionChange = 'completed';
            } elseif (! $column->is_done_column && $fromColumn->is_done_column && $task->completed_at !== null) {
                $updateData['completed_at'] = null;
                $completionChange = 'uncompleted';
            }
        }

        $task->update($updateData);

        return [
            'task' => $task,
            'column' => $column,
            'from_column' => $fromColumn,
            'from_board' => $fromBoard,
            'target_board' => $targetBoard,
            'cross_board' => $crossBoard,
            'sort_order' => $resolvedSortOrder,
            'completion_change' => $completionChange,
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

        // Logged before the move itself to match ToggleTaskCompletion's
        // ordering (completed first, then moved).
        if (! empty($move['completion_change'])) {
            ActivityLogger::log($task, $move['completion_change'], [], $actor);
        }

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
