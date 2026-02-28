<?php

use App\Http\Controllers\AttachmentController;
use App\Http\Controllers\BoardController;
use App\Http\Controllers\ColumnController;
use App\Http\Controllers\CommentController;
use App\Http\Controllers\LabelController;
use App\Http\Controllers\ProfileController;
use App\Http\Controllers\TaskController;
use App\Http\Controllers\TeamController;
use App\Http\Controllers\TeamMemberController;
use Illuminate\Foundation\Application;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

Route::get('/', function () {
    return Inertia::render('Welcome', [
        'canLogin' => Route::has('login'),
        'canRegister' => Route::has('register'),
        'laravelVersion' => Application::VERSION,
        'phpVersion' => PHP_VERSION,
    ]);
});

Route::get('/dashboard', function () {
    return Inertia::render('Dashboard');
})->middleware(['auth', 'verified'])->name('dashboard');

Route::middleware('auth')->group(function () {
    Route::get('/profile', [ProfileController::class, 'edit'])->name('profile.edit');
    Route::patch('/profile', [ProfileController::class, 'update'])->name('profile.update');
    Route::delete('/profile', [ProfileController::class, 'destroy'])->name('profile.destroy');

    // Teams
    Route::get('/teams', [TeamController::class, 'index'])->name('teams.index');
    Route::post('/teams', [TeamController::class, 'store'])->name('teams.store');

    Route::middleware('team.member')->group(function () {
        Route::get('/teams/{team}', [TeamController::class, 'show'])->name('teams.show');
        Route::put('/teams/{team}', [TeamController::class, 'update'])->name('teams.update');
        Route::delete('/teams/{team}', [TeamController::class, 'destroy'])->name('teams.destroy');

        // Team Members
        Route::post('/teams/{team}/members', [TeamMemberController::class, 'store'])->name('teams.members.store');
        Route::put('/teams/{team}/members/{user}', [TeamMemberController::class, 'update'])->name('teams.members.update');
        Route::delete('/teams/{team}/members/{user}', [TeamMemberController::class, 'destroy'])->name('teams.members.destroy');

        // Boards
        Route::post('/teams/{team}/boards', [BoardController::class, 'store'])->name('teams.boards.store');
        Route::get('/teams/{team}/boards/{board}', [BoardController::class, 'show'])->name('teams.boards.show');
        Route::put('/teams/{team}/boards/{board}', [BoardController::class, 'update'])->name('teams.boards.update');
        Route::post('/teams/{team}/boards/{board}/archive', [BoardController::class, 'archive'])->name('teams.boards.archive');
        Route::get('/teams/{team}/boards/{board}/settings', [BoardController::class, 'settings'])->name('teams.boards.settings');

        // Columns
        Route::post('/teams/{team}/boards/{board}/columns', [ColumnController::class, 'store'])->name('teams.boards.columns.store');
        Route::put('/teams/{team}/boards/{board}/columns/{column}', [ColumnController::class, 'update'])->name('teams.boards.columns.update');
        Route::put('/teams/{team}/boards/{board}/columns', [ColumnController::class, 'reorder'])->name('teams.boards.columns.reorder');
        Route::delete('/teams/{team}/boards/{board}/columns/{column}', [ColumnController::class, 'destroy'])->name('teams.boards.columns.destroy');

        // Tasks
        Route::post('/teams/{team}/boards/{board}/columns/{column}/tasks', [TaskController::class, 'store'])->name('tasks.store');
        Route::get('/teams/{team}/boards/{board}/tasks/{task}', [TaskController::class, 'show'])->name('tasks.show');
        Route::put('/teams/{team}/boards/{board}/tasks/{task}', [TaskController::class, 'update'])->name('tasks.update');
        Route::delete('/teams/{team}/boards/{board}/tasks/{task}', [TaskController::class, 'destroy'])->name('tasks.destroy');
        Route::patch('/teams/{team}/boards/{board}/tasks/{task}/move', [TaskController::class, 'move'])->name('tasks.move');
        Route::put('/teams/{team}/boards/{board}/tasks/{task}/assignees', [TaskController::class, 'updateAssignees'])->name('tasks.assignees.update');
        Route::put('/teams/{team}/boards/{board}/tasks/{task}/labels', [TaskController::class, 'updateLabels'])->name('tasks.labels.update');

        // Comments
        Route::post('/teams/{team}/boards/{board}/tasks/{task}/comments', [CommentController::class, 'store'])->name('comments.store');
        Route::put('/teams/{team}/boards/{board}/tasks/{task}/comments/{comment}', [CommentController::class, 'update'])->name('comments.update');
        Route::delete('/teams/{team}/boards/{board}/tasks/{task}/comments/{comment}', [CommentController::class, 'destroy'])->name('comments.destroy');

        // Attachments
        Route::post('/teams/{team}/boards/{board}/tasks/{task}/attachments', [AttachmentController::class, 'store'])->name('attachments.store');
        Route::get('/teams/{team}/boards/{board}/tasks/{task}/attachments/{attachment}', [AttachmentController::class, 'download'])->name('attachments.download');
        Route::delete('/teams/{team}/boards/{board}/tasks/{task}/attachments/{attachment}', [AttachmentController::class, 'destroy'])->name('attachments.destroy');

        // Labels
        Route::get('/teams/{team}/labels', [LabelController::class, 'index'])->name('labels.index');
        Route::post('/teams/{team}/labels', [LabelController::class, 'store'])->name('labels.store');
        Route::put('/teams/{team}/labels/{label}', [LabelController::class, 'update'])->name('labels.update');
        Route::delete('/teams/{team}/labels/{label}', [LabelController::class, 'destroy'])->name('labels.destroy');
    });
});

require __DIR__.'/auth.php';
