<?php

namespace App\Actions\Boards;

use App\Events\BoardChanged;
use App\Models\Board;
use Illuminate\Support\Facades\Auth;
use Lorisleiva\Actions\Concerns\AsAction;

class DeleteBoard
{
    use AsAction;

    public function handle(Board $board): void
    {
        // Delete tasks via Eloquent to trigger media library cleanup
        $board->tasks()->each(function ($task) {
            $task->delete();
        });

        // Broadcast deletion event before deleting
        broadcast(new BoardChanged(
            boardId: $board->id,
            action: 'board.deleted',
            data: ['board_id' => $board->id],
            userId: Auth::id(),
        ))->toOthers();

        $board->delete();
    }
}
