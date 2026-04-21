<?php

use App\Http\Controllers\NotificationController;
use Illuminate\Support\Facades\Route;

Route::get('/notifications', [
    NotificationController::class,
    'index',
])->name('notifications.index');
Route::patch('/notifications/{id}/read', [
    NotificationController::class,
    'markRead',
])->name('notifications.read');
Route::post('/notifications/read-all', [
    NotificationController::class,
    'markAllRead',
])->name('notifications.read-all');
Route::delete('/notifications', [
    NotificationController::class,
    'clearAll',
])->name('notifications.clear-all');
