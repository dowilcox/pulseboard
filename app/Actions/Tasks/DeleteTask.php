<?php

namespace App\Actions\Tasks;

use App\Events\BoardChanged;
use App\Models\Task;
use Illuminate\Support\Facades\Auth;
use Lorisleiva\Actions\Concerns\AsAction;

class DeleteTask
{
    use AsAction;

    public function handle(Task $task): void
    {
        $boardId = $task->board_id;
        $taskId = $task->id;
        $columnId = $task->column_id;

        $task->delete();

        broadcast(new BoardChanged(
            boardId: $boardId,
            action: 'task.deleted',
            data: [
                'task_id' => $taskId,
                'column_id' => $columnId,
            ],
            userId: Auth::id(),
        ))->toOthers();
    }
}
