<?php

use App\Http\Controllers\Admin\ApiTokenController;
use App\Http\Controllers\Admin\BoardController as AdminBoardController;
use App\Http\Controllers\Admin\DashboardController as AdminDashboardController;
use App\Http\Controllers\Admin\SsoConfigurationController;
use App\Http\Controllers\Admin\TeamController as AdminTeamController;
use App\Http\Controllers\Admin\UserController as AdminUserController;
use Illuminate\Support\Facades\Route;

Route::middleware('admin')
    ->prefix('admin')
    ->name('admin.')
    ->group(function () {
        Route::get('/', [AdminDashboardController::class, 'index'])->name(
            'dashboard',
        );

        Route::get('/users', [AdminUserController::class, 'index'])->name(
            'users.index',
        );
        Route::post('/users', [AdminUserController::class, 'store'])->name(
            'users.store',
        );
        Route::put('/users/{user}', [
            AdminUserController::class,
            'update',
        ])->name('users.update');
        Route::post('/users/{user}/toggle-active', [
            AdminUserController::class,
            'toggleActive',
        ])->name('users.toggle-active');
        Route::post('/users/{user}/reset-password', [
            AdminUserController::class,
            'resetPassword',
        ])->name('users.reset-password');

        Route::get('/teams', [AdminTeamController::class, 'index'])->name(
            'teams.index',
        );
        Route::get('/teams/{team}', [
            AdminTeamController::class,
            'show',
        ])->name('teams.show');
        Route::delete('/teams/{team}', [
            AdminTeamController::class,
            'destroy',
        ])->name('teams.destroy');
        Route::get('/teams/{team}/members/search', [
            AdminTeamController::class,
            'searchUsers',
        ])->name('teams.members.search');
        Route::post('/teams/{team}/members', [
            AdminTeamController::class,
            'addMember',
        ])->name('teams.members.store');
        Route::delete('/teams/{team}/members/{user}', [
            AdminTeamController::class,
            'removeMember',
        ])->name('teams.members.destroy');

        Route::get('/boards', [AdminBoardController::class, 'index'])->name(
            'boards.index',
        );
        Route::delete('/boards/{board}', [
            AdminBoardController::class,
            'destroy',
        ])->name('boards.destroy');

        Route::get('/sso', [
            SsoConfigurationController::class,
            'index',
        ])->name('sso.index');
        Route::post('/sso', [
            SsoConfigurationController::class,
            'store',
        ])->name('sso.store');
        Route::put('/sso/{ssoConfiguration}', [
            SsoConfigurationController::class,
            'update',
        ])->name('sso.update');
        Route::delete('/sso/{ssoConfiguration}', [
            SsoConfigurationController::class,
            'destroy',
        ])->name('sso.destroy');
        Route::post('/sso/{ssoConfiguration}/test', [
            SsoConfigurationController::class,
            'test',
        ])->name('sso.test');

        Route::get('/api-tokens', [
            ApiTokenController::class,
            'index',
        ])->name('api-tokens.index');
        Route::post('/api-tokens/{user}/tokens', [
            ApiTokenController::class,
            'createToken',
        ])->name('api-tokens.create-token');
        Route::delete('/api-tokens/{user}/tokens/{tokenId}', [
            ApiTokenController::class,
            'revokeToken',
        ])->name('api-tokens.revoke-token');
    });
