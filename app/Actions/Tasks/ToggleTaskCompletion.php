<?php

namespace App\Actions\Tasks;

use App\Models\Column;
use App\Models\Task;
use App\Models\User;
use App\Services\ActivityLogger;
use Illuminate\Support\Facades\DB;
use Lorisleiva\Actions\Concerns\AsAction;

class ToggleTaskCompletion
{
    use AsAction;

    public function handle(Task $task, ?User $user = null): Task
    {
        $markComplete = $task->completed_at === null;
        $move = null;

        DB::transaction(function () use ($task, $markComplete, &$move) {
            if ($markComplete) {
                $task->loadMissing('board');
                $board = $task->board;

                if ($board->setting('auto_move_to_done')) {
                    $doneColumn = Column::where('board_id', $board->id)
                        ->where('is_done_column', true)
                        ->orderBy('sort_order')
                        ->first();

                    if ($doneColumn && $doneColumn->id !== $task->column_id) {
                        // This action manages completed_at itself, so opt out
                        // of MoveTask's done-column completion sync to avoid a
                        // duplicate 'completed' activity.
                        $move = app(MoveTask::class)->applyMove(
                            $task,
                            $doneColumn,
                            null,
                            syncCompletion: false,
                        );
                    }
                }
            }

            $task->completed_at = $markComplete ? now() : null;
            $task->save();
        });

        ActivityLogger::log($task, $markComplete ? 'completed' : 'uncompleted', [], $user);

        if ($move) {
            app(MoveTask::class)->recordMove($move, $user, ['auto_moved' => true]);
        }

        return $task->fresh();
    }
}
