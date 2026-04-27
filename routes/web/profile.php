<?php

use App\Http\Controllers\ProfileController;
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
