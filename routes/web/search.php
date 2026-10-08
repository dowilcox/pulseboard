<?php

use App\Http\Controllers\SearchController;
use Illuminate\Support\Facades\Route;

// Global quick switcher task search (JSON). Must be registered before the
// slug-based /{team} catch-all routes.
Route::get('/search', SearchController::class)
    ->middleware('throttle:60,1')
    ->name('search');
