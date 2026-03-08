<?php

use App\Http\Controllers\Api\GitlabWebhookController;
use App\Http\Controllers\Api\V1\BoardController;
use App\Http\Controllers\Api\V1\CommentController;
use App\Http\Controllers\Api\V1\MeController;
use App\Http\Controllers\Api\V1\TaskController;
use App\Http\Controllers\Api\V1\TeamController;
use App\Http\Controllers\Api\V1\TokenController;
use App\Http\Middleware\EnsureTeamMember;
use App\Http\Middleware\VerifyGitlabWebhook;
use Illuminate\Support\Facades\Route;

Route::post('/webhooks/gitlab/{connection}', [GitlabWebhookController::class, 'handle'])
    ->middleware(VerifyGitlabWebhook::class)
    ->name('webhooks.gitlab');

Route::prefix('v1')->middleware(['auth:sanctum', 'ensure.active', 'throttle:api'])->name('api.v1.')->group(function () {
    // Me
    Route::get('/me', [MeController::class, 'show'])->name('me');
    Route::get('/me/tasks', [MeController::class, 'tasks'])->name('me.tasks');

    // Tokens (self-service)
    Route::get('/tokens', [TokenController::class, 'index'])->name('tokens.index');
    Route::post('/tokens', [TokenController::class, 'store'])->name('tokens.store');
    Route::delete('/tokens/{id}', [TokenController::class, 'destroy'])->name('tokens.destroy');

    // Teams
    Route::get('/teams', [TeamController::class, 'index'])->name('teams.index');

    Route::middleware(EnsureTeamMember::class)->group(function () {
        Route::get('/teams/{team}', [TeamController::class, 'show'])->name('teams.show');
        Route::get('/teams/{team}/members', [TeamController::class, 'members'])->name('teams.members');

        // Boards
        Route::get('/teams/{team}/boards', [BoardController::class, 'index'])->name('teams.boards.index');
        Route::get('/teams/{team}/boards/{board}', [BoardController::class, 'show'])->name('teams.boards.show');
        Route::get('/teams/{team}/boards/{board}/labels', [BoardController::class, 'labels'])->name('teams.boards.labels');

        // Tasks (read)
        Route::get('/teams/{team}/boards/{board}/tasks', [TaskController::class, 'index'])->name('teams.boards.tasks.index');
        Route::get('/teams/{team}/boards/{board}/tasks/{task}', [TaskController::class, 'show'])->name('teams.boards.tasks.show');

        // Comments (read)
        Route::get('/teams/{team}/boards/{board}/tasks/{task}/comments', [CommentController::class, 'index'])->name('teams.boards.tasks.comments.index');

        // Write endpoints require 'write' ability
        Route::middleware('abilities:write')->group(function () {
            Route::post('/teams/{team}/boards/{board}/columns/{column}/tasks', [TaskController::class, 'store'])->name('teams.boards.columns.tasks.store');
            Route::put('/teams/{team}/boards/{board}/tasks/{task}', [TaskController::class, 'update'])->name('teams.boards.tasks.update');
            Route::patch('/teams/{team}/boards/{board}/tasks/{task}/move', [TaskController::class, 'move'])->name('teams.boards.tasks.move');
            Route::patch('/teams/{team}/boards/{board}/tasks/{task}/complete', [TaskController::class, 'complete'])->name('teams.boards.tasks.complete');
            Route::put('/teams/{team}/boards/{board}/tasks/{task}/assignees', [TaskController::class, 'assignees'])->name('teams.boards.tasks.assignees');
            Route::put('/teams/{team}/boards/{board}/tasks/{task}/labels', [TaskController::class, 'labels'])->name('teams.boards.tasks.labels');
            Route::post('/teams/{team}/boards/{board}/tasks/{task}/comments', [CommentController::class, 'store'])->name('teams.boards.tasks.comments.store');
        });
    });
});
