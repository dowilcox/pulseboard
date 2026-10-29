<?php

namespace App\Mcp\Tools;

use App\Actions\Tasks\MoveTask as MoveTaskAction;
use App\Mcp\Exceptions\ToolException;
use App\Mcp\Support\Presenter;
use App\Models\Column;
use App\Models\Task;
use App\Models\User;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\Server\Attributes\Description;
use Laravel\Mcp\Server\Attributes\Name;

#[Name('move_task')]
#[Description('Move a task to another column (and optionally a position within it), like dragging the card in the UI. Moving into a "done" column marks the task completed; moving out of one reopens it. WIP limits are enforced. Set `target_board` to move the task to another board of the same team (requires team admin/owner; the task gets a new number there). Requires a token with the "write" ability.')]
class MoveTask extends PulseBoardTool
{
    protected ?string $ability = 'write';

    public function schema(JsonSchema $schema): array
    {
        return [
            'task' => $schema->string()->description('Task UUID, or task number together with `board`, or "board-slug#12".')->required(),
            'board' => $schema->string()->description('The task\'s current board (UUID, slug, or "team-slug/board-slug"). Required when `task` is a number.'),
            'team' => $schema->string()->description('Team slug or UUID; only needed when a board slug is ambiguous.'),
            'column' => $schema->string()->description('Destination column UUID or name (on the target board if `target_board` is set).')->required(),
            'position' => $schema->integer()->min(1)->description('1-based position in the destination column (1 = top). Default: bottom.'),
            'target_board' => $schema->string()->description('Board (UUID or slug, same team) to move the task to. Omit to stay on the current board.'),
        ];
    }

    protected function run(Request $request, User $user): Response
    {
        $request->validate([
            'task' => ['required', 'string', 'max:255'],
            'board' => ['nullable', 'string', 'max:255'],
            'team' => ['nullable', 'string', 'max:255'],
            'column' => ['required', 'string', 'max:255'],
            'position' => ['nullable', 'integer', 'min:1'],
            'target_board' => ['nullable', 'string', 'max:255'],
        ]);

        $task = $this->resolveTask($user, $request->get('task'), $request->get('board'), $request->get('team'));
        $board = $task->board;
        $team = $board->team;

        $this->authorizeFor($user, 'update', $task, 'You are not allowed to move this task.');

        $destinationBoard = $board;

        if (filled($request->get('target_board'))) {
            $destinationBoard = $this->resolveBoard($user, $request->get('target_board'), $team->id);

            if ($destinationBoard->team_id !== $team->id) {
                throw new ToolException('Tasks can only be moved to boards of the same team.');
            }
        }

        $columnId = $this->resolveColumn($destinationBoard, $request->get('column'))->id;

        // Same scoping and authorization as the REST API's move endpoint.
        [$targetBoard, $column] = app(MoveTaskAction::class)->resolveTarget(
            $team,
            $board,
            $destinationBoard->id,
            $columnId,
        );

        if ($targetBoard) {
            $this->authorizeFor($user, 'update', $targetBoard, 'Moving tasks to another board requires the admin or owner role on the team.');
        }

        $fromColumn = $task->column;
        $sortOrder = $this->sortOrderFor($column, $task, $request->get('position'));

        $task = MoveTaskAction::run($task, $column, $sortOrder, $targetBoard, $user);
        $task->load(Presenter::TASK_SUMMARY_RELATIONS);

        return $this->json([
            'moved' => true,
            'from' => Presenter::compact(['board' => $board->slug, 'column' => $fromColumn?->name]),
            'task' => Presenter::taskSummary($task),
        ]);
    }

    /**
     * Translate a 1-based position into a sort_order between the
     * neighbouring cards (fractional ordering, like the drag-and-drop UI).
     */
    private function sortOrderFor(Column $column, Task $task, mixed $position): ?float
    {
        if ($position === null) {
            return null;
        }

        $orders = Task::query()
            ->where('column_id', $column->id)
            ->whereKeyNot($task->id)
            ->orderBy('sort_order')
            ->pluck('sort_order')
            ->map(fn ($order) => (float) $order)
            ->values();

        $index = (int) $position - 1;

        if ($orders->isEmpty() || $index >= $orders->count()) {
            return null;
        }

        if ($index <= 0) {
            return $orders->first() - 1;
        }

        return ($orders[$index - 1] + $orders[$index]) / 2;
    }
}
