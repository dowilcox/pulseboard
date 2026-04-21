<?php

use App\Http\Controllers\Api\BoardTaskController;
use App\Http\Controllers\AttachmentController;
use App\Http\Controllers\AutomationRuleController;
use App\Http\Controllers\BoardController;
use App\Http\Controllers\BoardTemplateController;
use App\Http\Controllers\ColumnController;
use App\Http\Controllers\CommentController;
use App\Http\Controllers\SavedFilterController;
use App\Http\Controllers\TaskController;
use App\Http\Controllers\TaskDependencyController;
use App\Http\Controllers\TaskFigmaController;
use App\Http\Controllers\TaskGitlabController;
use App\Http\Controllers\TaskTemplateController;
use Illuminate\Support\Facades\Route;

// This catch-all block must remain after every fixed /{team}/... route.
Route::get('/{team}/{board}', [BoardController::class, 'show'])->name(
    'teams.boards.show',
);
Route::put('/{team}/{board}', [BoardController::class, 'update'])->name(
    'teams.boards.update',
);
Route::post('/{team}/{board}/archive', [BoardController::class, 'archive'])->name(
    'teams.boards.archive',
);
Route::delete('/{team}/{board}', [BoardController::class, 'destroy'])->name(
    'teams.boards.destroy',
);
Route::get('/{team}/{board}/settings', [
    BoardController::class,
    'settings',
])->name('teams.boards.settings');
Route::post('/{team}/{board}/image', [
    BoardController::class,
    'uploadImage',
])->name('teams.boards.upload-image');
Route::delete('/{team}/{board}/image', [
    BoardController::class,
    'deleteImage',
])->name('teams.boards.delete-image');
Route::get('/{team}/{board}/tasks', [
    BoardTaskController::class,
    'index',
])->name('boards.tasks.index');

Route::post('/{team}/{board}/columns', [ColumnController::class, 'store'])->name(
    'teams.boards.columns.store',
);
Route::put('/{team}/{board}/columns/{column}', [
    ColumnController::class,
    'update',
])->name('teams.boards.columns.update');
Route::put('/{team}/{board}/columns', [ColumnController::class, 'reorder'])->name(
    'teams.boards.columns.reorder',
);
Route::delete('/{team}/{board}/columns/{column}', [
    ColumnController::class,
    'destroy',
])->name('teams.boards.columns.destroy');

Route::post('/{team}/{board}/columns/{column}/tasks', [
    TaskController::class,
    'store',
])->name('tasks.store');
Route::get('/{team}/{board}/tasks/{task}', [TaskController::class, 'show'])->name(
    'tasks.show',
);
Route::put('/{team}/{board}/tasks/{task}', [TaskController::class, 'update'])->name(
    'tasks.update',
);
Route::delete('/{team}/{board}/tasks/{task}', [
    TaskController::class,
    'destroy',
])->name('tasks.destroy');
Route::patch('/{team}/{board}/tasks/{task}/move', [TaskController::class, 'move'])->name(
    'tasks.move',
);
Route::put('/{team}/{board}/tasks/{task}/assignees', [
    TaskController::class,
    'updateAssignees',
])->name('tasks.assignees.update');
Route::put('/{team}/{board}/tasks/{task}/labels', [
    TaskController::class,
    'updateLabels',
])->name('tasks.labels.update');
Route::patch('/{team}/{board}/tasks/{task}/toggle-complete', [
    TaskController::class,
    'toggleComplete',
])->name('tasks.toggle-complete');
Route::patch('/{team}/{board}/tasks/{task}/toggle-watch', [
    TaskController::class,
    'toggleWatch',
])->name('tasks.toggle-watch');
Route::post('/{team}/{board}/tasks/{task}/images', [
    TaskController::class,
    'uploadImage',
])->name('tasks.images.store');

Route::post('/{team}/{board}/tasks/{task}/dependencies', [
    TaskDependencyController::class,
    'store',
])->name('tasks.dependencies.store');
Route::delete('/{team}/{board}/tasks/{task}/dependencies/{dependsOnTask}', [
    TaskDependencyController::class,
    'destroy',
])->name('tasks.dependencies.destroy');

Route::post('/{team}/{board}/tasks/{task}/save-template', [
    TaskTemplateController::class,
    'createFromTask',
])->name('tasks.save-template');
Route::post('/{team}/{board}/columns/{column}/from-template/{taskTemplate}', [
    TaskTemplateController::class,
    'createTask',
])->name('tasks.from-template');

Route::put('/{team}/{board}/tasks/{task}/gitlab/project', [
    TaskGitlabController::class,
    'setProject',
])->name('tasks.gitlab.set-project');
Route::get('/{team}/{board}/tasks/{task}/gitlab', [
    TaskGitlabController::class,
    'index',
])->name('tasks.gitlab.index');
Route::post('/{team}/{board}/tasks/{task}/gitlab/branch', [
    TaskGitlabController::class,
    'createBranch',
])->name('tasks.gitlab.branch');
Route::post('/{team}/{board}/tasks/{task}/gitlab/merge-request', [
    TaskGitlabController::class,
    'createMergeRequest',
])->name('tasks.gitlab.merge-request');
Route::delete('/{team}/{board}/tasks/{task}/gitlab/{ref}', [
    TaskGitlabController::class,
    'destroy',
])->name('tasks.gitlab.destroy');

Route::post('/{team}/{board}/tasks/{task}/comments', [
    CommentController::class,
    'store',
])->name('comments.store');
Route::put('/{team}/{board}/tasks/{task}/comments/{comment}', [
    CommentController::class,
    'update',
])->name('comments.update');
Route::delete('/{team}/{board}/tasks/{task}/comments/{comment}', [
    CommentController::class,
    'destroy',
])->name('comments.destroy');

Route::post('/{team}/{board}/tasks/{task}/attachments', [
    AttachmentController::class,
    'store',
])->name('attachments.store');
Route::get('/{team}/{board}/tasks/{task}/attachments/{media}', [
    AttachmentController::class,
    'download',
])->name('attachments.download');
Route::get('/{team}/{board}/tasks/{task}/attachments/{media}/view', [
    AttachmentController::class,
    'view',
])->name('attachments.view');
Route::delete('/{team}/{board}/tasks/{task}/attachments/{media}', [
    AttachmentController::class,
    'destroy',
])->name('attachments.destroy');

Route::get('/{team}/{board}/tasks/{task}/figma', [
    TaskFigmaController::class,
    'index',
])->name('tasks.figma.index');
Route::post('/{team}/{board}/tasks/{task}/figma', [
    TaskFigmaController::class,
    'store',
])->name('tasks.figma.store');
Route::delete('/{team}/{board}/tasks/{task}/figma/{link}', [
    TaskFigmaController::class,
    'destroy',
])->name('tasks.figma.destroy');

Route::get('/{team}/{board}/automation-rules', [
    AutomationRuleController::class,
    'index',
])->name('boards.automation-rules.index');
Route::post('/{team}/{board}/automation-rules', [
    AutomationRuleController::class,
    'store',
])->name('boards.automation-rules.store');
Route::put('/{team}/{board}/automation-rules/{automationRule}', [
    AutomationRuleController::class,
    'update',
])->name('boards.automation-rules.update');
Route::delete('/{team}/{board}/automation-rules/{automationRule}', [
    AutomationRuleController::class,
    'destroy',
])->name('boards.automation-rules.destroy');

Route::post('/{team}/{board}/create-template', [
    BoardTemplateController::class,
    'createFromBoard',
])->name('boards.create-template');

Route::get('/{team}/{board}/filters', [
    SavedFilterController::class,
    'index',
])->name('boards.filters.index');
Route::post('/{team}/{board}/filters', [
    SavedFilterController::class,
    'store',
])->name('boards.filters.store');
Route::put('/{team}/{board}/filters/{savedFilter}', [
    SavedFilterController::class,
    'update',
])->name('boards.filters.update');
Route::delete('/{team}/{board}/filters/{savedFilter}', [
    SavedFilterController::class,
    'destroy',
])->name('boards.filters.destroy');
