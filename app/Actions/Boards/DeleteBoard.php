<?php

namespace App\Actions\Boards;

use App\Events\BoardChanged;
use App\Models\Board;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Storage;
use Lorisleiva\Actions\Concerns\AsAction;

class DeleteBoard
{
    use AsAction;

    public function handle(Board $board): void
    {
        // Collect and delete attachment files
        $tasks = $board->tasks()->with('attachments')->get();
        $filePaths = $tasks->flatMap(fn ($task) => $task->attachments->pluck('file_path'));

        foreach ($filePaths as $path) {
            Storage::disk('local')->delete($path);
        }

        // Broadcast deletion event before deleting
        broadcast(new BoardChanged(
            boardId: $board->id,
            action: 'board.deleted',
            data: ['board_id' => $board->id],
            userId: Auth::id(),
        ))->toOthers();

        // FK cascades handle all DB records
        $board->delete();
    }
}
