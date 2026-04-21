<?php

use App\Http\Controllers\BoardTemplateController;
use Illuminate\Support\Facades\Route;

Route::get('/templates', [BoardTemplateController::class, 'index'])->name(
    'templates.index',
);
Route::post('/templates', [BoardTemplateController::class, 'store'])->name(
    'templates.store',
);
Route::delete('/templates/{boardTemplate}', [
    BoardTemplateController::class,
    'destroy',
])->name('templates.destroy');
