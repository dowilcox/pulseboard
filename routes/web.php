<?php

use App\Http\Controllers\Admin\ApiTokenController;
use App\Http\Controllers\Admin\BoardController as AdminBoardController;
use App\Http\Controllers\Admin\DashboardController as AdminDashboardController;
use App\Http\Controllers\Admin\SsoConfigurationController;
use App\Http\Controllers\Admin\TeamController as AdminTeamController;
use App\Http\Controllers\Admin\UserController as AdminUserController;
use App\Http\Controllers\Api\BoardTaskController;
use App\Http\Controllers\AttachmentController;
use App\Http\Controllers\Auth\SamlController;
use App\Http\Controllers\AutomationRuleController;
use App\Http\Controllers\AvatarController;
use App\Http\Controllers\BoardController;
use App\Http\Controllers\BoardTemplateController;
use App\Http\Controllers\ColumnController;
use App\Http\Controllers\CommentController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\FigmaConnectionController;
use App\Http\Controllers\GitlabConnectionController;
use App\Http\Controllers\GitlabProjectController;
use App\Http\Controllers\LabelController;
use App\Http\Controllers\NotificationController;
use App\Http\Controllers\ProfileController;
use App\Http\Controllers\SavedFilterController;
use App\Http\Controllers\TaskController;
use App\Http\Controllers\TaskDependencyController;
use App\Http\Controllers\TaskFigmaController;
use App\Http\Controllers\TaskGitlabController;
use App\Http\Controllers\TaskTemplateController;
use App\Http\Controllers\TeamBotController;
use App\Http\Controllers\TeamController;
use App\Http\Controllers\TeamMemberController;
use App\Models\AppSetting;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

Route::get('/', function () {
    if (Auth::check()) {
        return redirect()->route('dashboard');
    }

    return Inertia::render('Welcome', [
        'canLogin' => Route::has('login'),
        'canRegister' => Route::has('register') && ! AppSetting::isLocalAuthDisabled(),
    ]);
});

// Public avatar endpoint
Route::get('/avatars/{user}', [AvatarController::class, 'show'])
    ->middleware('throttle:60,1')
    ->name('avatars.show');

// SAML SSO routes (no auth required)
Route::get('/auth/saml/login', [SamlController::class, 'redirect'])
    ->middleware('throttle:10,1')
    ->name('saml.login');
Route::post('/auth/saml/acs', [SamlController::class, 'acs'])
    ->middleware('throttle:10,1')
    ->name('saml.acs');
Route::get('/auth/saml/metadata', [SamlController::class, 'metadata'])
    ->middleware('throttle:10,1')
    ->name('saml.metadata');

Route::get('/dashboard', [DashboardController::class, 'index'])
    ->middleware(['auth', 'verified'])
    ->name('dashboard');

// Auth routes must be registered before the {team} catch-all
require __DIR__.'/auth.php';

Route::middleware('auth')->group(function () {
    Route::get('/profile', [ProfileController::class, 'edit'])->name(
        'profile.edit',
    );
    Route::patch('/profile', [ProfileController::class, 'update'])->name(
        'profile.update',
    );
    Route::patch('/profile/theme', [
        ProfileController::class,
        'updateTheme',
    ])->name('profile.theme.update');
    Route::patch('/profile/notifications', [
        ProfileController::class,
        'updateNotifications',
    ])->name('profile.notifications.update');
    Route::patch('/profile/ui-preferences', [
        ProfileController::class,
        'updateUiPreferences',
    ])->name('profile.ui-preferences.update');
    Route::delete('/profile', [ProfileController::class, 'destroy'])->name(
        'profile.destroy',
    );

    // Notifications
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

    // Admin
    Route::middleware('admin')
        ->prefix('admin')
        ->name('admin.')
        ->group(function () {
            Route::get('/', [AdminDashboardController::class, 'index'])->name(
                'dashboard',
            );

            // Users
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

            // Teams
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

            // Boards
            Route::get('/boards', [AdminBoardController::class, 'index'])->name(
                'boards.index',
            );
            Route::delete('/boards/{board}', [
                AdminBoardController::class,
                'destroy',
            ])->name('boards.destroy');

            // SSO Configuration
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

            // API Tokens (admin oversight)
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

    // Board Templates (static route — must be above {team} catch-all)
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

    // Teams index & create (static routes — must be above {team} catch-all)
    Route::get('/teams', [TeamController::class, 'index'])->name('teams.index');
    Route::post('/teams', [TeamController::class, 'store'])->name(
        'teams.store',
    );

    // Team-scoped routes (slug-based: /{team}/...)
    // IMPORTANT: All /{team}/fixed-path routes must come BEFORE /{team}/{board} catch-all
    Route::middleware('team.member')->group(function () {
        // Team management
        Route::get('/{team}', [TeamController::class, 'show'])->name(
            'teams.show',
        );
        Route::put('/{team}', [TeamController::class, 'update'])->name(
            'teams.update',
        );
        Route::delete('/{team}', [
            TeamController::class,
            'destroy',
        ])->name('teams.destroy');
        Route::get('/{team}/settings', [
            TeamController::class,
            'settings',
        ])->name('teams.settings');
        Route::post('/{team}/image', [
            TeamController::class,
            'uploadImage',
        ])->name('teams.upload-image');
        Route::delete('/{team}/image', [
            TeamController::class,
            'deleteImage',
        ])->name('teams.delete-image');

        // Team Members
        Route::get('/{team}/members/search', [
            TeamMemberController::class,
            'search',
        ])->name('teams.members.search');
        Route::post('/{team}/members', [
            TeamMemberController::class,
            'store',
        ])->name('teams.members.store');
        Route::put('/{team}/members/{user}', [
            TeamMemberController::class,
            'update',
        ])->name('teams.members.update');
        Route::delete('/{team}/members/{user}', [
            TeamMemberController::class,
            'destroy',
        ])->name('teams.members.destroy');

        // Board creation (fixed path before catch-all)
        Route::post('/{team}/boards', [
            BoardController::class,
            'store',
        ])->name('teams.boards.store');

        // Task Templates (fixed path before catch-all)
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

        // Team Dashboard (fixed path before catch-all)
        Route::get('/{team}/dashboard/stats', [
            DashboardController::class,
            'teamStats',
        ])->name('teams.dashboard.stats');
        Route::get('/{team}/export/csv', [
            DashboardController::class,
            'exportCsv',
        ])->name('teams.export.csv');

        // Team Bots & API Tokens (fixed path before catch-all)
        Route::get('/{team}/bots', [
            TeamBotController::class,
            'index',
        ])->name('teams.bots.index');
        Route::post('/{team}/bots', [
            TeamBotController::class,
            'storeBot',
        ])->name('teams.bots.store');
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

        // Figma Connections (fixed path before catch-all)
        Route::get('/{team}/figma', [
            FigmaConnectionController::class,
            'index',
        ])->name('teams.figma.index');
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

        // GitLab Connections (fixed path before catch-all)
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
        Route::post(
            '/{team}/gitlab/connections/{gitlabConnection}/test',
            [GitlabConnectionController::class, 'test'],
        )->name('teams.gitlab-connections.test');

        // GitLab Projects (fixed path before catch-all)
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

        // Labels (fixed path before catch-all)
        Route::get('/{team}/labels', [
            LabelController::class,
            'index',
        ])->name('labels.index');
        Route::post('/{team}/labels', [
            LabelController::class,
            'store',
        ])->name('labels.store');
        Route::put('/{team}/labels/{label}', [
            LabelController::class,
            'update',
        ])->name('labels.update');
        Route::delete('/{team}/labels/{label}', [
            LabelController::class,
            'destroy',
        ])->name('labels.destroy');

        // Board Templates (team-scoped, fixed path)
        Route::post('/{team}/templates/{boardTemplate}/create-board', [
            BoardTemplateController::class,
            'createBoardFromTemplate',
        ])->name('teams.templates.create-board');

        // ---- Board catch-all routes (/{team}/{board}/...) must come LAST ----
        Route::get('/{team}/{board}', [
            BoardController::class,
            'show',
        ])->name('teams.boards.show');
        Route::put('/{team}/{board}', [
            BoardController::class,
            'update',
        ])->name('teams.boards.update');
        Route::post('/{team}/{board}/archive', [
            BoardController::class,
            'archive',
        ])->name('teams.boards.archive');
        Route::delete('/{team}/{board}', [
            BoardController::class,
            'destroy',
        ])->name('teams.boards.destroy');
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

        // Columns
        Route::post('/{team}/{board}/columns', [
            ColumnController::class,
            'store',
        ])->name('teams.boards.columns.store');
        Route::put('/{team}/{board}/columns/{column}', [
            ColumnController::class,
            'update',
        ])->name('teams.boards.columns.update');
        Route::put('/{team}/{board}/columns', [
            ColumnController::class,
            'reorder',
        ])->name('teams.boards.columns.reorder');
        Route::delete('/{team}/{board}/columns/{column}', [
            ColumnController::class,
            'destroy',
        ])->name('teams.boards.columns.destroy');

        // Tasks
        Route::post('/{team}/{board}/columns/{column}/tasks', [
            TaskController::class,
            'store',
        ])->name('tasks.store');
        Route::get('/{team}/{board}/tasks/{task}', [
            TaskController::class,
            'show',
        ])->name('tasks.show');
        Route::put('/{team}/{board}/tasks/{task}', [
            TaskController::class,
            'update',
        ])->name('tasks.update');
        Route::delete('/{team}/{board}/tasks/{task}', [
            TaskController::class,
            'destroy',
        ])->name('tasks.destroy');
        Route::patch('/{team}/{board}/tasks/{task}/move', [
            TaskController::class,
            'move',
        ])->name('tasks.move');
        Route::put('/{team}/{board}/tasks/{task}/assignees', [
            TaskController::class,
            'updateAssignees',
        ])->name('tasks.assignees.update');
        Route::put('/{team}/{board}/tasks/{task}/labels', [
            TaskController::class,
            'updateLabels',
        ])->name('tasks.labels.update');
        Route::patch(
            '/{team}/{board}/tasks/{task}/toggle-complete',
            [TaskController::class, 'toggleComplete'],
        )->name('tasks.toggle-complete');
        Route::post('/{team}/{board}/tasks/{task}/images', [
            TaskController::class,
            'uploadImage',
        ])->name('tasks.images.store');

        // Task Dependencies
        Route::post('/{team}/{board}/tasks/{task}/dependencies', [
            TaskDependencyController::class,
            'store',
        ])->name('tasks.dependencies.store');
        Route::delete(
            '/{team}/{board}/tasks/{task}/dependencies/{dependsOnTask}',
            [TaskDependencyController::class, 'destroy'],
        )->name('tasks.dependencies.destroy');

        // Task Templates (board-scoped)
        Route::post('/{team}/{board}/tasks/{task}/save-template', [
            TaskTemplateController::class,
            'createFromTask',
        ])->name('tasks.save-template');
        Route::post(
            '/{team}/{board}/columns/{column}/from-template/{taskTemplate}',
            [TaskTemplateController::class, 'createTask'],
        )->name('tasks.from-template');

        // Task GitLab
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
        Route::post(
            '/{team}/{board}/tasks/{task}/gitlab/merge-request',
            [TaskGitlabController::class, 'createMergeRequest'],
        )->name('tasks.gitlab.merge-request');
        Route::delete(
            '/{team}/{board}/tasks/{task}/gitlab/{ref}',
            [TaskGitlabController::class, 'destroy'],
        )->name('tasks.gitlab.destroy');

        // Comments
        Route::post('/{team}/{board}/tasks/{task}/comments', [
            CommentController::class,
            'store',
        ])->name('comments.store');
        Route::put(
            '/{team}/{board}/tasks/{task}/comments/{comment}',
            [CommentController::class, 'update'],
        )->name('comments.update');
        Route::delete(
            '/{team}/{board}/tasks/{task}/comments/{comment}',
            [CommentController::class, 'destroy'],
        )->name('comments.destroy');

        // Attachments
        Route::post('/{team}/{board}/tasks/{task}/attachments', [
            AttachmentController::class,
            'store',
        ])->name('attachments.store');
        Route::get(
            '/{team}/{board}/tasks/{task}/attachments/{media}',
            [AttachmentController::class, 'download'],
        )->name('attachments.download');
        Route::get(
            '/{team}/{board}/tasks/{task}/attachments/{media}/view',
            [AttachmentController::class, 'view'],
        )->name('attachments.view');
        Route::delete(
            '/{team}/{board}/tasks/{task}/attachments/{media}',
            [AttachmentController::class, 'destroy'],
        )->name('attachments.destroy');

        // Task Figma Links
        Route::get('/{team}/{board}/tasks/{task}/figma', [
            TaskFigmaController::class,
            'index',
        ])->name('tasks.figma.index');
        Route::post('/{team}/{board}/tasks/{task}/figma', [
            TaskFigmaController::class,
            'store',
        ])->name('tasks.figma.store');
        Route::delete(
            '/{team}/{board}/tasks/{task}/figma/{link}',
            [TaskFigmaController::class, 'destroy'],
        )->name('tasks.figma.destroy');

        // Automation Rules
        Route::get('/{team}/{board}/automation-rules', [
            AutomationRuleController::class,
            'index',
        ])->name('boards.automation-rules.index');
        Route::post('/{team}/{board}/automation-rules', [
            AutomationRuleController::class,
            'store',
        ])->name('boards.automation-rules.store');
        Route::put(
            '/{team}/{board}/automation-rules/{automationRule}',
            [AutomationRuleController::class, 'update'],
        )->name('boards.automation-rules.update');
        Route::delete(
            '/{team}/{board}/automation-rules/{automationRule}',
            [AutomationRuleController::class, 'destroy'],
        )->name('boards.automation-rules.destroy');

        // Board Templates (board-scoped)
        Route::post('/{team}/{board}/create-template', [
            BoardTemplateController::class,
            'createFromBoard',
        ])->name('boards.create-template');

        // Saved Filters
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
    });
});
