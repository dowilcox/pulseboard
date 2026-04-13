<?php

use App\Models\Board;
use Illuminate\Support\Facades\Broadcast;

Broadcast::channel('board.{boardId}', function ($user, string $boardId) {
    $board = Board::find($boardId);

    return $board && $board->team->hasUser($user);
});

Broadcast::channel('board-presence.{boardId}', function ($user, string $boardId) {
    $board = Board::find($boardId);

    if ($board && $board->team->hasUser($user)) {
        return [
            'id' => $user->id,
            'name' => $user->name,
            'avatar_url' => $user->avatar_url,
        ];
    }

    return false;
});

Broadcast::channel('user.{userId}', function ($user, string $userId) {
    return $user->id === $userId;
});
