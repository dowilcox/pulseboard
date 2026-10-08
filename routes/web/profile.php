<?php

use App\Http\Controllers\ProfileController;
use App\Http\Controllers\ProfileTokenController;
use Illuminate\Support\Facades\Route;

Route::get('/profile', [ProfileController::class, 'edit'])->name(
    'profile.edit',
);
Route::patch('/profile', [ProfileController::class, 'update'])->name(
    'profile.update',
);
Route::patch('/profile/notifications', [
    ProfileController::class,
    'updateNotifications',
])->name('profile.notifications.update');
Route::patch('/profile/ui-preferences', [
    ProfileController::class,
    'updateUiPreferences',
])->name('profile.ui-preferences.update');
Route::delete('/profile', [ProfileController::class, 'destroy'])
    ->middleware('throttle:5,1')
    ->name('profile.destroy');

// Self-service API tokens (session-authenticated; scoped to the user).
Route::get('/profile/tokens', [ProfileTokenController::class, 'index'])->name(
    'profile.tokens.index',
);
Route::post('/profile/tokens', [ProfileTokenController::class, 'store'])
    ->middleware('throttle:10,1')
    ->name('profile.tokens.store');
Route::delete('/profile/tokens/{token}', [
    ProfileTokenController::class,
    'destroy',
])
    ->whereNumber('token')
    ->name('profile.tokens.destroy');
