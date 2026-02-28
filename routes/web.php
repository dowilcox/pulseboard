<?php

use App\Http\Controllers\Admin\GitlabConnectionController;
use App\Http\Controllers\AttachmentController;
use App\Http\Controllers\AutomationRuleController;
use App\Http\Controllers\BoardController;
use App\Http\Controllers\BoardTemplateController;
use App\Http\Controllers\ColumnController;
use App\Http\Controllers\CommentController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\GitlabProjectController;
use App\Http\Controllers\LabelController;
use App\Http\Controllers\NotificationController;
use App\Http\Controllers\ProfileController;
use App\Http\Controllers\SavedFilterController;
use App\Http\Controllers\TaskController;
use App\Http\Controllers\TaskGitlabController;
use App\Http\Controllers\TeamController;
use App\Http\Controllers\TeamMemberController;
use Illuminate\Foundation\Application;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

Route::get('/', function () {
    return Inertia::render('Welcome', [
        'canLogin' => Route::has('login'),
        'canRegister' => Route::has('register'),
        'laravelVersion' => Application::VERSION,
        'phpVersion' => PHP_VERSION,
    ]);
});

Route::get('/dashboard', [DashboardController::class, 'index'])
    ->middleware(['auth', 'verified'])->name('dashboard');

Route::middleware('auth')->group(function () {
    Route::get('/profile', [ProfileController::class, 'edit'])->name('profile.edit');
    Route::patch('/profile', [ProfileController::class, 'update'])->name('profile.update');
    Route::patch('/profile/notifications', [ProfileController::class, 'updateNotifications'])->name('profile.notifications.update');
    Route::delete('/profile', [ProfileController::class, 'destroy'])->name('profile.destroy');

    // Notifications
    Route::get('/notifications', [NotificationController::class, 'index'])->name('notifications.index');
    Route::patch('/notifications/{id}/read', [NotificationController::class, 'markRead'])->name('notifications.read');
    Route::post('/notifications/read-all', [NotificationController::class, 'markAllRead'])->name('notifications.read-all');

    // Admin
    Route::middleware('admin')->prefix('admin')->name('admin.')->group(function () {
        Route::get('/gitlab-connections', [GitlabConnectionController::class, 'index'])->name('gitlab-connections.index');
        Route::post('/gitlab-connections', [GitlabConnectionController::class, 'store'])->name('gitlab-connections.store');
        Route::put('/gitlab-connections/{gitlabConnection}', [GitlabConnectionController::class, 'update'])->name('gitlab-connections.update');
        Route::delete('/gitlab-connections/{gitlabConnection}', [GitlabConnectionController::class, 'destroy'])->name('gitlab-connections.destroy');
        Route::post('/gitlab-connections/{gitlabConnection}/test', [GitlabConnectionController::class, 'testConnection'])->name('gitlab-connections.test');
    });

    // Board Templates
    Route::get('/templates', [BoardTemplateController::class, 'index'])->name('templates.index');
    Route::post('/templates', [BoardTemplateController::class, 'store'])->name('templates.store');
    Route::delete('/templates/{boardTemplate}', [BoardTemplateController::class, 'destroy'])->name('templates.destroy');

    // Teams
    Route::get('/teams', [TeamController::class, 'index'])->name('teams.index');
    Route::post('/teams', [TeamController::class, 'store'])->name('teams.store');

    Route::middleware('team.member')->group(function () {
        Route::get('/teams/{team}', [TeamController::class, 'show'])->name('teams.show');
        Route::put('/teams/{team}', [TeamController::class, 'update'])->name('teams.update');
        Route::delete('/teams/{team}', [TeamController::class, 'destroy'])->name('teams.destroy');

        // Team Members
        Route::post('/teams/{team}/members', [TeamMemberController::class, 'store'])->name('teams.members.store');
        Route::put('/teams/{team}/members/{user}', [TeamMemberController::class, 'update'])->name('teams.members.update');
        Route::delete('/teams/{team}/members/{user}', [TeamMemberController::class, 'destroy'])->name('teams.members.destroy');

        // Boards
        Route::post('/teams/{team}/boards', [BoardController::class, 'store'])->name('teams.boards.store');
        Route::get('/teams/{team}/boards/{board}', [BoardController::class, 'show'])->name('teams.boards.show');
        Route::put('/teams/{team}/boards/{board}', [BoardController::class, 'update'])->name('teams.boards.update');
        Route::post('/teams/{team}/boards/{board}/archive', [BoardController::class, 'archive'])->name('teams.boards.archive');
        Route::get('/teams/{team}/boards/{board}/settings', [BoardController::class, 'settings'])->name('teams.boards.settings');

        // Columns
        Route::post('/teams/{team}/boards/{board}/columns', [ColumnController::class, 'store'])->name('teams.boards.columns.store');
        Route::put('/teams/{team}/boards/{board}/columns/{column}', [ColumnController::class, 'update'])->name('teams.boards.columns.update');
        Route::put('/teams/{team}/boards/{board}/columns', [ColumnController::class, 'reorder'])->name('teams.boards.columns.reorder');
        Route::delete('/teams/{team}/boards/{board}/columns/{column}', [ColumnController::class, 'destroy'])->name('teams.boards.columns.destroy');

        // Tasks
        Route::post('/teams/{team}/boards/{board}/columns/{column}/tasks', [TaskController::class, 'store'])->name('tasks.store');
        Route::get('/teams/{team}/boards/{board}/tasks/{task}', [TaskController::class, 'show'])->name('tasks.show');
        Route::put('/teams/{team}/boards/{board}/tasks/{task}', [TaskController::class, 'update'])->name('tasks.update');
        Route::delete('/teams/{team}/boards/{board}/tasks/{task}', [TaskController::class, 'destroy'])->name('tasks.destroy');
        Route::patch('/teams/{team}/boards/{board}/tasks/{task}/move', [TaskController::class, 'move'])->name('tasks.move');
        Route::put('/teams/{team}/boards/{board}/tasks/{task}/assignees', [TaskController::class, 'updateAssignees'])->name('tasks.assignees.update');
        Route::put('/teams/{team}/boards/{board}/tasks/{task}/labels', [TaskController::class, 'updateLabels'])->name('tasks.labels.update');

        // Task GitLab
        Route::get('/teams/{team}/boards/{board}/tasks/{task}/gitlab', [TaskGitlabController::class, 'index'])->name('tasks.gitlab.index');
        Route::post('/teams/{team}/boards/{board}/tasks/{task}/gitlab/branch', [TaskGitlabController::class, 'createBranch'])->name('tasks.gitlab.branch');
        Route::post('/teams/{team}/boards/{board}/tasks/{task}/gitlab/merge-request', [TaskGitlabController::class, 'createMergeRequest'])->name('tasks.gitlab.merge-request');
        Route::delete('/teams/{team}/boards/{board}/tasks/{task}/gitlab/{link}', [TaskGitlabController::class, 'destroy'])->name('tasks.gitlab.destroy');

        // Comments
        Route::post('/teams/{team}/boards/{board}/tasks/{task}/comments', [CommentController::class, 'store'])->name('comments.store');
        Route::put('/teams/{team}/boards/{board}/tasks/{task}/comments/{comment}', [CommentController::class, 'update'])->name('comments.update');
        Route::delete('/teams/{team}/boards/{board}/tasks/{task}/comments/{comment}', [CommentController::class, 'destroy'])->name('comments.destroy');

        // Attachments
        Route::post('/teams/{team}/boards/{board}/tasks/{task}/attachments', [AttachmentController::class, 'store'])->name('attachments.store');
        Route::get('/teams/{team}/boards/{board}/tasks/{task}/attachments/{attachment}', [AttachmentController::class, 'download'])->name('attachments.download');
        Route::delete('/teams/{team}/boards/{board}/tasks/{task}/attachments/{attachment}', [AttachmentController::class, 'destroy'])->name('attachments.destroy');

        // Team Dashboard
        Route::get('/teams/{team}/dashboard', [DashboardController::class, 'teamDashboard'])->name('teams.dashboard');
        Route::get('/teams/{team}/dashboard/stats', [DashboardController::class, 'teamStats'])->name('teams.dashboard.stats');
        Route::get('/teams/{team}/export/csv', [DashboardController::class, 'exportCsv'])->name('teams.export.csv');

        // GitLab Projects
        Route::get('/teams/{team}/gitlab/projects', [GitlabProjectController::class, 'index'])->name('teams.gitlab-projects.index');
        Route::get('/teams/{team}/gitlab/search', [GitlabProjectController::class, 'search'])->name('teams.gitlab-projects.search');
        Route::post('/teams/{team}/gitlab/projects', [GitlabProjectController::class, 'store'])->name('teams.gitlab-projects.store');
        Route::delete('/teams/{team}/gitlab/projects/{gitlabProject}', [GitlabProjectController::class, 'destroy'])->name('teams.gitlab-projects.destroy');

        // Automation Rules
        Route::get('/teams/{team}/boards/{board}/automation-rules', [AutomationRuleController::class, 'index'])->name('boards.automation-rules.index');
        Route::post('/teams/{team}/boards/{board}/automation-rules', [AutomationRuleController::class, 'store'])->name('boards.automation-rules.store');
        Route::put('/teams/{team}/boards/{board}/automation-rules/{automationRule}', [AutomationRuleController::class, 'update'])->name('boards.automation-rules.update');
        Route::delete('/teams/{team}/boards/{board}/automation-rules/{automationRule}', [AutomationRuleController::class, 'destroy'])->name('boards.automation-rules.destroy');

        // Board Templates
        Route::post('/teams/{team}/boards/{board}/create-template', [BoardTemplateController::class, 'createFromBoard'])->name('boards.create-template');
        Route::post('/teams/{team}/templates/{boardTemplate}/create-board', [BoardTemplateController::class, 'createBoardFromTemplate'])->name('teams.templates.create-board');

        // Saved Filters
        Route::get('/teams/{team}/boards/{board}/filters', [SavedFilterController::class, 'index'])->name('boards.filters.index');
        Route::post('/teams/{team}/boards/{board}/filters', [SavedFilterController::class, 'store'])->name('boards.filters.store');
        Route::put('/teams/{team}/boards/{board}/filters/{savedFilter}', [SavedFilterController::class, 'update'])->name('boards.filters.update');
        Route::delete('/teams/{team}/boards/{board}/filters/{savedFilter}', [SavedFilterController::class, 'destroy'])->name('boards.filters.destroy');

        // Labels
        Route::get('/teams/{team}/labels', [LabelController::class, 'index'])->name('labels.index');
        Route::post('/teams/{team}/labels', [LabelController::class, 'store'])->name('labels.store');
        Route::put('/teams/{team}/labels/{label}', [LabelController::class, 'update'])->name('labels.update');
        Route::delete('/teams/{team}/labels/{label}', [LabelController::class, 'destroy'])->name('labels.destroy');
    });
});

require __DIR__.'/auth.php';
