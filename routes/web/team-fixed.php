<?php

use App\Http\Controllers\BoardController;
use App\Http\Controllers\BoardTemplateController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\FigmaConnectionController;
use App\Http\Controllers\GitlabConnectionController;
use App\Http\Controllers\GitlabProjectController;
use App\Http\Controllers\LabelController;
use App\Http\Controllers\TaskTemplateController;
use App\Http\Controllers\TeamBotController;
use App\Http\Controllers\TeamController;
use App\Http\Controllers\TeamMemberController;
use Illuminate\Support\Facades\Route;

Route::get('/{team}', [TeamController::class, 'show'])->name(
    'teams.show',
);
Route::put('/{team}', [TeamController::class, 'update'])->name(
    'teams.update',
);
Route::delete('/{team}', [TeamController::class, 'destroy'])->name(
    'teams.destroy',
);
Route::get('/{team}/settings', [TeamController::class, 'settings'])->name(
    'teams.settings',
);
Route::post('/{team}/image', [TeamController::class, 'uploadImage'])->name(
    'teams.upload-image',
);
Route::delete('/{team}/image', [TeamController::class, 'deleteImage'])->name(
    'teams.delete-image',
);

Route::get('/{team}/members/search', [
    TeamMemberController::class,
    'search',
])->name('teams.members.search');
Route::post('/{team}/members', [TeamMemberController::class, 'store'])->name(
    'teams.members.store',
);
Route::put('/{team}/members/{user}', [
    TeamMemberController::class,
    'update',
])->name('teams.members.update');
Route::delete('/{team}/members/{user}', [
    TeamMemberController::class,
    'destroy',
])->name('teams.members.destroy');

Route::post('/{team}/boards', [BoardController::class, 'store'])
    ->middleware('throttle:10,1')
    ->name('teams.boards.store');

Route::get('/{team}/task-templates', [
    TaskTemplateController::class,
    'index',
])->name('teams.task-templates.index');
Route::post('/{team}/task-templates', [
    TaskTemplateController::class,
    'store',
])->name('teams.task-templates.store');
Route::delete('/{team}/task-templates/{taskTemplate}', [
    TaskTemplateController::class,
    'destroy',
])->name('teams.task-templates.destroy');

Route::get('/{team}/dashboard/stats', [
    DashboardController::class,
    'teamStats',
])->name('teams.dashboard.stats');
Route::get('/{team}/export/csv', [
    DashboardController::class,
    'exportCsv',
])->name('teams.export.csv');

Route::get('/{team}/bots', [TeamBotController::class, 'index'])->name(
    'teams.bots.index',
);
Route::post('/{team}/bots', [TeamBotController::class, 'storeBot'])->name(
    'teams.bots.store',
);
Route::delete('/{team}/bots/{user}', [
    TeamBotController::class,
    'destroyBot',
])->name('teams.bots.destroy');
Route::post('/{team}/bots/{user}/tokens', [
    TeamBotController::class,
    'createToken',
])->name('teams.bots.create-token');
Route::delete('/{team}/bots/{user}/tokens/{tokenId}', [
    TeamBotController::class,
    'revokeToken',
])->name('teams.bots.revoke-token');

Route::get('/{team}/figma', [FigmaConnectionController::class, 'index'])->name(
    'teams.figma.index',
);
Route::post('/{team}/figma/connections', [
    FigmaConnectionController::class,
    'store',
])->name('teams.figma-connections.store');
Route::put('/{team}/figma/connections/{figmaConnection}', [
    FigmaConnectionController::class,
    'update',
])->name('teams.figma-connections.update');
Route::delete('/{team}/figma/connections/{figmaConnection}', [
    FigmaConnectionController::class,
    'destroy',
])->name('teams.figma-connections.destroy');
Route::post('/{team}/figma/connections/{figmaConnection}/test', [
    FigmaConnectionController::class,
    'test',
])->name('teams.figma-connections.test');

Route::post('/{team}/gitlab/connections', [
    GitlabConnectionController::class,
    'store',
])->name('teams.gitlab-connections.store');
Route::put('/{team}/gitlab/connections/{gitlabConnection}', [
    GitlabConnectionController::class,
    'update',
])->name('teams.gitlab-connections.update');
Route::delete('/{team}/gitlab/connections/{gitlabConnection}', [
    GitlabConnectionController::class,
    'destroy',
])->name('teams.gitlab-connections.destroy');
Route::post('/{team}/gitlab/connections/{gitlabConnection}/test', [
    GitlabConnectionController::class,
    'test',
])->name('teams.gitlab-connections.test');

Route::get('/{team}/gitlab/projects', [
    GitlabProjectController::class,
    'index',
])->name('teams.gitlab-projects.index');
Route::get('/{team}/gitlab/search', [
    GitlabProjectController::class,
    'search',
])->name('teams.gitlab-projects.search');
Route::post('/{team}/gitlab/projects', [
    GitlabProjectController::class,
    'store',
])->name('teams.gitlab-projects.store');
Route::delete('/{team}/gitlab/projects/{gitlabProject}', [
    GitlabProjectController::class,
    'destroy',
])->name('teams.gitlab-projects.destroy');

Route::get('/{team}/labels', [LabelController::class, 'index'])->name(
    'labels.index',
);
Route::post('/{team}/labels', [LabelController::class, 'store'])->name(
    'labels.store',
);
Route::put('/{team}/labels/{label}', [LabelController::class, 'update'])->name(
    'labels.update',
);
Route::delete('/{team}/labels/{label}', [
    LabelController::class,
    'destroy',
])->name('labels.destroy');

Route::post('/{team}/templates/{boardTemplate}/create-board', [
    BoardTemplateController::class,
    'createBoardFromTemplate',
])->name('teams.templates.create-board');
