<?php

use App\Http\Controllers\TeamController;
use Illuminate\Support\Facades\Route;

Route::get('/teams', [TeamController::class, 'index'])->name('teams.index');
Route::post('/teams', [TeamController::class, 'store'])
    ->middleware('throttle:10,1')
    ->name('teams.store');

Route::middleware('team.member')->group(function () {
    require __DIR__.'/team-fixed.php';
    require __DIR__.'/board-scoped.php';
});
