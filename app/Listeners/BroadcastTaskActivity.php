<?php

namespace App\Listeners;

use App\Events\BoardChanged;
use App\Events\TaskActivityLogged;

class BroadcastTaskActivity
{
    public function handle(TaskActivityLogged $event): void
    {
        broadcast(
            new BoardChanged(
                boardId: $event->task->board_id,
                action: $event->action,
                data: [
                    'task_id' => $event->task->id,
                    'changes' => $event->changes,
                ],
                userId: $event->actor?->id ?? 'system',
            ),
        )->toOthers();
    }
}
