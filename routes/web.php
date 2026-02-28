<?php

use App\Http\Controllers\BoardController;
use App\Http\Controllers\ColumnController;
use App\Http\Controllers\ProfileController;
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
    });
});

require __DIR__.'/auth.php';
