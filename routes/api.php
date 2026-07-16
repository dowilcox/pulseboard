<?php

use App\Http\Controllers\Api\GitlabWebhookController;
use App\Http\Controllers\Api\V1\AttachmentController;
use App\Http\Controllers\Api\V1\BoardController;
use App\Http\Controllers\Api\V1\BoardTemplateController;
use App\Http\Controllers\Api\V1\ColumnController;
use App\Http\Controllers\Api\V1\CommentController;
use App\Http\Controllers\Api\V1\DashboardController;
use App\Http\Controllers\Api\V1\LabelController;
use App\Http\Controllers\Api\V1\MeController;
use App\Http\Controllers\Api\V1\NotificationController;
use App\Http\Controllers\Api\V1\TaskController;
use App\Http\Controllers\Api\V1\TaskDependencyController;
use App\Http\Controllers\Api\V1\TaskFigmaController;
use App\Http\Controllers\Api\V1\TaskGitlabController;
use App\Http\Controllers\Api\V1\TaskTemplateController;
use App\Http\Controllers\Api\V1\TeamController;
use App\Http\Controllers\Api\V1\TeamMemberController;
use App\Http\Controllers\Api\V1\TokenController;
use App\Http\Middleware\EnsureTeamMember;
use App\Http\Middleware\VerifyGitlabWebhook;
use Illuminate\Support\Facades\Route;

Route::post('/webhooks/gitlab/{connection}', [GitlabWebhookController::class, 'handle'])
    ->middleware(VerifyGitlabWebhook::class)
    ->name('webhooks.gitlab');

/*
 * Token abilities:
 *   read   — implicit for all GET endpoints (every token can read what its user can see)
 *   write  — content mutations (tasks, comments, attachments, templates, integrations, notifications)
 *   manage — structural/administrative mutations (teams, members, boards, columns, labels)
 */
Route::prefix('v1')->middleware(['auth:sanctum', 'ensure.active', 'throttle:api'])->name('api.v1.')->group(function () {
    // Me
    Route::get('/me', [MeController::class, 'show'])->name('me');
    Route::get('/me/tasks', [MeController::class, 'tasks'])->name('me.tasks');

    // Tokens (self-service)
    Route::get('/tokens', [TokenController::class, 'index'])->name('tokens.index');
    Route::post('/tokens', [TokenController::class, 'store'])->name('tokens.store');
    Route::delete('/tokens/{id}', [TokenController::class, 'destroy'])->name('tokens.destroy');

    // Notifications (self-scoped)
    Route::get('/notifications', [NotificationController::class, 'index'])->name('notifications.index');
    Route::middleware('abilities:write')->group(function () {
        Route::patch('/notifications/{id}/read', [NotificationController::class, 'markRead'])->name('notifications.read');
        Route::post('/notifications/read-all', [NotificationController::class, 'markAllRead'])->name('notifications.read-all');
        Route::delete('/notifications', [NotificationController::class, 'clearAll'])->name('notifications.clear-all');
    });

    // Board templates (global gallery)
    Route::get('/templates', [BoardTemplateController::class, 'index'])->name('templates.index');
    Route::middleware('abilities:write')->group(function () {
        Route::post('/templates', [BoardTemplateController::class, 'store'])->name('templates.store');
        Route::delete('/templates/{boardTemplate}', [BoardTemplateController::class, 'destroy'])->name('templates.destroy');
    });

    // Teams
    Route::get('/teams', [TeamController::class, 'index'])->name('teams.index');
    Route::post('/teams', [TeamController::class, 'store'])
        ->middleware('abilities:manage')
        ->name('teams.store');

    Route::middleware(EnsureTeamMember::class)->group(function () {
        Route::get('/teams/{team}', [TeamController::class, 'show'])->name('teams.show');
        Route::get('/teams/{team}/members', [TeamController::class, 'members'])->name('teams.members');

        // Team-scoped reads
        Route::get('/teams/{team}/labels', [LabelController::class, 'index'])->name('teams.labels.index');
        Route::get('/teams/{team}/task-templates', [TaskTemplateController::class, 'index'])->name('teams.task-templates.index');
        Route::get('/teams/{team}/dashboard/stats', [DashboardController::class, 'teamStats'])->name('teams.dashboard.stats');
        Route::get('/teams/{team}/export/csv', [DashboardController::class, 'exportCsv'])->name('teams.export.csv');

        // Boards
        Route::get('/teams/{team}/boards', [BoardController::class, 'index'])->name('teams.boards.index');
        Route::get('/teams/{team}/boards/{board}', [BoardController::class, 'show'])->name('teams.boards.show');
        Route::get('/teams/{team}/boards/{board}/labels', [BoardController::class, 'labels'])->name('teams.boards.labels');

        // Tasks (read)
        Route::get('/teams/{team}/boards/{board}/tasks', [TaskController::class, 'index'])->name('teams.boards.tasks.index');
        Route::get('/teams/{team}/boards/{board}/tasks/{task}', [TaskController::class, 'show'])->name('teams.boards.tasks.show');

        // Comments (read)
        Route::get('/teams/{team}/boards/{board}/tasks/{task}/comments', [CommentController::class, 'index'])->name('teams.boards.tasks.comments.index');

        // Attachments (read)
        Route::get('/teams/{team}/boards/{board}/tasks/{task}/attachments', [AttachmentController::class, 'index'])->name('teams.boards.tasks.attachments.index');
        Route::get('/teams/{team}/boards/{board}/tasks/{task}/attachments/{media}/download', [AttachmentController::class, 'download'])->name('teams.boards.tasks.attachments.download');

        // Integrations (read)
        Route::get('/teams/{team}/boards/{board}/tasks/{task}/gitlab', [TaskGitlabController::class, 'index'])->name('teams.boards.tasks.gitlab.index');
        Route::get('/teams/{team}/boards/{board}/tasks/{task}/figma', [TaskFigmaController::class, 'index'])->name('teams.boards.tasks.figma.index');

        // Content mutations require the 'write' ability
        Route::middleware('abilities:write')->group(function () {
            // Tasks
            Route::post('/teams/{team}/boards/{board}/columns/{column}/tasks', [TaskController::class, 'store'])->name('teams.boards.columns.tasks.store');
            Route::post('/teams/{team}/boards/{board}/columns/{column}/tasks/from-template/{taskTemplate}', [TaskTemplateController::class, 'createTask'])->name('teams.boards.columns.tasks.from-template');
            Route::put('/teams/{team}/boards/{board}/tasks/{task}', [TaskController::class, 'update'])->name('teams.boards.tasks.update');
            Route::delete('/teams/{team}/boards/{board}/tasks/{task}', [TaskController::class, 'destroy'])->name('teams.boards.tasks.destroy');
            Route::patch('/teams/{team}/boards/{board}/tasks/{task}/move', [TaskController::class, 'move'])->name('teams.boards.tasks.move');
            Route::patch('/teams/{team}/boards/{board}/tasks/{task}/complete', [TaskController::class, 'complete'])->name('teams.boards.tasks.complete');
            Route::patch('/teams/{team}/boards/{board}/tasks/{task}/watch', [TaskController::class, 'watch'])->name('teams.boards.tasks.watch');
            Route::put('/teams/{team}/boards/{board}/tasks/{task}/assignees', [TaskController::class, 'assignees'])->name('teams.boards.tasks.assignees');
            Route::put('/teams/{team}/boards/{board}/tasks/{task}/labels', [TaskController::class, 'labels'])->name('teams.boards.tasks.labels');
            Route::post('/teams/{team}/boards/{board}/tasks/{task}/save-template', [TaskTemplateController::class, 'createFromTask'])->name('teams.boards.tasks.save-template');

            // Dependencies
            Route::post('/teams/{team}/boards/{board}/tasks/{task}/dependencies', [TaskDependencyController::class, 'store'])->name('teams.boards.tasks.dependencies.store');
            Route::delete('/teams/{team}/boards/{board}/tasks/{task}/dependencies/{dependsOnTask}', [TaskDependencyController::class, 'destroy'])->name('teams.boards.tasks.dependencies.destroy');

            // Comments
            Route::post('/teams/{team}/boards/{board}/tasks/{task}/comments', [CommentController::class, 'store'])->name('teams.boards.tasks.comments.store');
            Route::put('/teams/{team}/boards/{board}/tasks/{task}/comments/{comment}', [CommentController::class, 'update'])->name('teams.boards.tasks.comments.update');
            Route::delete('/teams/{team}/boards/{board}/tasks/{task}/comments/{comment}', [CommentController::class, 'destroy'])->name('teams.boards.tasks.comments.destroy');

            // Attachments
            Route::post('/teams/{team}/boards/{board}/tasks/{task}/attachments', [AttachmentController::class, 'store'])->name('teams.boards.tasks.attachments.store');
            Route::delete('/teams/{team}/boards/{board}/tasks/{task}/attachments/{media}', [AttachmentController::class, 'destroy'])->name('teams.boards.tasks.attachments.destroy');

            // Task templates (team-scoped content)
            Route::post('/teams/{team}/task-templates', [TaskTemplateController::class, 'store'])->name('teams.task-templates.store');
            Route::delete('/teams/{team}/task-templates/{taskTemplate}', [TaskTemplateController::class, 'destroy'])->name('teams.task-templates.destroy');

            // Board template from board (creates template content)
            Route::post('/teams/{team}/boards/{board}/create-template', [BoardTemplateController::class, 'createFromBoard'])->name('teams.boards.create-template');

            // GitLab task operations
            Route::put('/teams/{team}/boards/{board}/tasks/{task}/gitlab/project', [TaskGitlabController::class, 'setProject'])->name('teams.boards.tasks.gitlab.set-project');
            Route::post('/teams/{team}/boards/{board}/tasks/{task}/gitlab/branch', [TaskGitlabController::class, 'createBranch'])->name('teams.boards.tasks.gitlab.branch');
            Route::post('/teams/{team}/boards/{board}/tasks/{task}/gitlab/merge-request', [TaskGitlabController::class, 'createMergeRequest'])->name('teams.boards.tasks.gitlab.merge-request');
            Route::delete('/teams/{team}/boards/{board}/tasks/{task}/gitlab/{ref}', [TaskGitlabController::class, 'destroyRef'])->name('teams.boards.tasks.gitlab.destroy-ref');

            // Figma task links
            Route::post('/teams/{team}/boards/{board}/tasks/{task}/figma', [TaskFigmaController::class, 'store'])->name('teams.boards.tasks.figma.store');
            Route::delete('/teams/{team}/boards/{board}/tasks/{task}/figma/{link}', [TaskFigmaController::class, 'destroy'])->name('teams.boards.tasks.figma.destroy');
        });

        // Structural/administrative mutations require the 'manage' ability
        Route::middleware('abilities:manage')->group(function () {
            // Team
            Route::put('/teams/{team}', [TeamController::class, 'update'])->name('teams.update');
            Route::delete('/teams/{team}', [TeamController::class, 'destroy'])->name('teams.destroy');

            // Members
            Route::get('/teams/{team}/members/search', [TeamMemberController::class, 'search'])->name('teams.members.search');
            Route::post('/teams/{team}/members', [TeamMemberController::class, 'store'])->name('teams.members.store');
            Route::put('/teams/{team}/members/{user}', [TeamMemberController::class, 'update'])->name('teams.members.update');
            Route::delete('/teams/{team}/members/{user}', [TeamMemberController::class, 'destroy'])->name('teams.members.destroy');

            // Boards
            Route::post('/teams/{team}/boards', [BoardController::class, 'store'])->name('teams.boards.store');
            Route::put('/teams/{team}/boards/{board}', [BoardController::class, 'update'])->name('teams.boards.update');
            Route::post('/teams/{team}/boards/{board}/archive', [BoardController::class, 'archive'])->name('teams.boards.archive');
            Route::delete('/teams/{team}/boards/{board}', [BoardController::class, 'destroy'])->name('teams.boards.destroy');
            Route::post('/teams/{team}/templates/{boardTemplate}/create-board', [BoardTemplateController::class, 'createBoard'])->name('teams.templates.create-board');

            // Columns
            Route::post('/teams/{team}/boards/{board}/columns', [ColumnController::class, 'store'])->name('teams.boards.columns.store');
            Route::put('/teams/{team}/boards/{board}/columns', [ColumnController::class, 'reorder'])->name('teams.boards.columns.reorder');
            Route::put('/teams/{team}/boards/{board}/columns/{column}', [ColumnController::class, 'update'])->name('teams.boards.columns.update');
            Route::delete('/teams/{team}/boards/{board}/columns/{column}', [ColumnController::class, 'destroy'])->name('teams.boards.columns.destroy');

            // Labels
            Route::post('/teams/{team}/labels', [LabelController::class, 'store'])->name('teams.labels.store');
            Route::put('/teams/{team}/labels/{label}', [LabelController::class, 'update'])->name('teams.labels.update');
            Route::delete('/teams/{team}/labels/{label}', [LabelController::class, 'destroy'])->name('teams.labels.destroy');
        });
    });
});
