<?php

namespace Database\Seeders;

use App\Models\Activity;
use App\Models\AutomationRule;
use App\Models\Board;
use App\Models\BoardTemplate;
use App\Models\Column;
use App\Models\Comment;
use App\Models\Label;
use App\Models\SavedFilter;
use App\Models\Task;
use App\Models\TaskDependency;
use App\Models\TaskTemplate;
use App\Models\Team;
use App\Models\TeamMember;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class DemoSeeder extends Seeder
{
    public function run(): void
    {
        $this->command->info('Creating demo data...');

        // ── Users ──────────────────────────────────────────────
        $admin = User::factory()->create([
            'name' => 'Alice Admin',
            'email' => 'alice@demo.test',
            'password' => Hash::make('password'),
            'is_admin' => true,
            'theme_preference' => 'light',
            'email_notification_prefs' => [
                'task_assigned' => true,
                'task_commented' => true,
                'task_mentioned' => true,
                'task_due_soon' => true,
                'task_overdue' => true,
            ],
        ]);

        $bob = User::factory()->create([
            'name' => 'Bob Builder',
            'email' => 'bob@demo.test',
            'password' => Hash::make('password'),
            'theme_preference' => 'dark',
        ]);

        $carol = User::factory()->create([
            'name' => 'Carol Chen',
            'email' => 'carol@demo.test',
            'password' => Hash::make('password'),
        ]);

        $dave = User::factory()->create([
            'name' => 'Dave Dawson',
            'email' => 'dave@demo.test',
            'password' => Hash::make('password'),
        ]);

        $eve = User::factory()->create([
            'name' => 'Eve Evans',
            'email' => 'eve@demo.test',
            'password' => Hash::make('password'),
        ]);

        $deactivated = User::factory()->create([
            'name' => 'Frank Former',
            'email' => 'frank@demo.test',
            'password' => Hash::make('password'),
            'deactivated_at' => now()->subWeeks(2),
        ]);

        $allUsers = [$admin, $bob, $carol, $dave, $eve];

        $this->command->info('  ✓ 6 users created (alice@demo.test is admin, frank@demo.test is deactivated)');

        // ── Teams ──────────────────────────────────────────────
        $engineeringTeam = Team::create([
            'name' => 'Engineering',
            'slug' => 'engineering',
            'description' => 'Core product engineering team',
            'settings' => [],
        ]);

        $designTeam = Team::create([
            'name' => 'Design',
            'slug' => 'design',
            'description' => 'UI/UX design team',
            'settings' => [],
        ]);

        $marketingTeam = Team::create([
            'name' => 'Marketing',
            'slug' => 'marketing',
            'description' => 'Marketing and growth team',
            'settings' => [],
        ]);

        // Team memberships
        TeamMember::create(['team_id' => $engineeringTeam->id, 'user_id' => $admin->id, 'role' => 'owner']);
        TeamMember::create(['team_id' => $engineeringTeam->id, 'user_id' => $bob->id, 'role' => 'admin']);
        TeamMember::create(['team_id' => $engineeringTeam->id, 'user_id' => $carol->id, 'role' => 'member']);
        TeamMember::create(['team_id' => $engineeringTeam->id, 'user_id' => $dave->id, 'role' => 'member']);
        TeamMember::create(['team_id' => $engineeringTeam->id, 'user_id' => $eve->id, 'role' => 'member']);

        TeamMember::create(['team_id' => $designTeam->id, 'user_id' => $carol->id, 'role' => 'owner']);
        TeamMember::create(['team_id' => $designTeam->id, 'user_id' => $admin->id, 'role' => 'member']);
        TeamMember::create(['team_id' => $designTeam->id, 'user_id' => $eve->id, 'role' => 'member']);

        TeamMember::create(['team_id' => $marketingTeam->id, 'user_id' => $dave->id, 'role' => 'owner']);
        TeamMember::create(['team_id' => $marketingTeam->id, 'user_id' => $eve->id, 'role' => 'admin']);
        TeamMember::create(['team_id' => $marketingTeam->id, 'user_id' => $admin->id, 'role' => 'member']);

        // Bot user on engineering team
        $bot = User::factory()->create([
            'name' => 'CI Bot',
            'email' => 'ci-bot@engineering.demo.test',
            'password' => Hash::make(Str::random(32)),
            'is_bot' => true,
            'created_by_team_id' => $engineeringTeam->id,
        ]);
        TeamMember::create(['team_id' => $engineeringTeam->id, 'user_id' => $bot->id, 'role' => 'member']);

        $this->command->info('  ✓ 3 teams with memberships + 1 bot user');

        // ── Labels ─────────────────────────────────────────────
        $labelDefs = [
            ['Bug', '#ef4444'],
            ['Feature', '#3b82f6'],
            ['Enhancement', '#8b5cf6'],
            ['Documentation', '#6366f1'],
            ['Urgent', '#dc2626'],
            ['Tech Debt', '#f59e0b'],
            ['Good First Issue', '#10b981'],
            ['Backend', '#0ea5e9'],
            ['Frontend', '#ec4899'],
            ['DevOps', '#64748b'],
        ];

        $engLabels = [];
        foreach ($labelDefs as [$name, $color]) {
            $engLabels[$name] = Label::create([
                'team_id' => $engineeringTeam->id,
                'name' => $name,
                'color' => $color,
            ]);
        }

        $designLabels = [];
        foreach ([['UI', '#ec4899'], ['UX', '#8b5cf6'], ['Accessibility', '#10b981'], ['Motion', '#f59e0b'], ['Icons', '#0ea5e9']] as [$name, $color]) {
            $designLabels[$name] = Label::create([
                'team_id' => $designTeam->id,
                'name' => $name,
                'color' => $color,
            ]);
        }

        $marketingLabels = [];
        foreach ([['Content', '#3b82f6'], ['Social', '#ec4899'], ['SEO', '#10b981'], ['Analytics', '#f59e0b'], ['Campaign', '#8b5cf6']] as [$name, $color]) {
            $marketingLabels[$name] = Label::create([
                'team_id' => $marketingTeam->id,
                'name' => $name,
                'color' => $color,
            ]);
        }

        $this->command->info('  ✓ Labels created for all teams');

        // ── Engineering Boards ─────────────────────────────────
        $sprintBoard = Board::create([
            'team_id' => $engineeringTeam->id,
            'name' => 'Sprint 24 - Q1 2026',
            'description' => 'Current sprint: auth improvements, API v2, performance',
            'sort_order' => 0,
            'settings' => ['default_view' => 'kanban'],
        ]);

        $sprintCols = [];
        foreach ([
            ['Backlog', '#94a3b8', null, false, 0],
            ['To Do', '#6366f1', 5, false, 1],
            ['In Progress', '#f59e0b', 3, false, 2],
            ['In Review', '#8b5cf6', 2, false, 3],
            ['Done', '#10b981', null, true, 4],
        ] as [$name, $color, $wip, $done, $order]) {
            $sprintCols[$name] = Column::create([
                'board_id' => $sprintBoard->id,
                'name' => $name,
                'color' => $color,
                'wip_limit' => $wip,
                'is_done_column' => $done,
                'sort_order' => $order,
            ]);
        }

        $backlogBoard = Board::create([
            'team_id' => $engineeringTeam->id,
            'name' => 'Product Backlog',
            'description' => 'All upcoming features and improvements',
            'sort_order' => 1,
            'settings' => ['default_view' => 'list'],
        ]);

        $backlogCols = [];
        foreach ([
            ['Ideas', '#94a3b8', null, false, 0],
            ['Refined', '#3b82f6', null, false, 1],
            ['Ready', '#10b981', null, false, 2],
            ['Won\'t Do', '#ef4444', null, true, 3],
        ] as [$name, $color, $wip, $done, $order]) {
            $backlogCols[$name] = Column::create([
                'board_id' => $backlogBoard->id,
                'name' => $name,
                'color' => $color,
                'wip_limit' => $wip,
                'is_done_column' => $done,
                'sort_order' => $order,
            ]);
        }

        $bugBoard = Board::create([
            'team_id' => $engineeringTeam->id,
            'name' => 'Bug Tracker',
            'description' => 'Bug reports and fixes',
            'sort_order' => 2,
        ]);

        $bugCols = [];
        foreach ([
            ['Reported', '#ef4444', null, false, 0],
            ['Triaged', '#f59e0b', null, false, 1],
            ['Fixing', '#3b82f6', 2, false, 2],
            ['Verifying', '#8b5cf6', null, false, 3],
            ['Closed', '#10b981', null, true, 4],
        ] as [$name, $color, $wip, $done, $order]) {
            $bugCols[$name] = Column::create([
                'board_id' => $bugBoard->id,
                'name' => $name,
                'color' => $color,
                'wip_limit' => $wip,
                'is_done_column' => $done,
                'sort_order' => $order,
            ]);
        }

        $archivedBoard = Board::create([
            'team_id' => $engineeringTeam->id,
            'name' => 'Sprint 23 (Archived)',
            'description' => 'Previous sprint - completed',
            'sort_order' => 3,
            'is_archived' => true,
        ]);
        Column::create(['board_id' => $archivedBoard->id, 'name' => 'Done', 'color' => '#10b981', 'is_done_column' => true, 'sort_order' => 0]);

        $this->command->info('  ✓ 4 engineering boards (1 archived)');

        // ── Sprint Board Tasks ─────────────────────────────────
        $taskNum = 0;
        $sprintTasks = [];

        // Done tasks (completed)
        foreach ([
            ['Set up OAuth2 provider integration', 'high', $admin, 'Done', 'Implement OAuth2 login flow with Google and GitHub providers. Include token refresh and account linking.'],
            ['Add rate limiting to API endpoints', 'medium', $bob, 'Done', 'Apply throttle middleware to all API routes. 60 req/min for authenticated, 20 for guests.'],
            ['Write unit tests for auth actions', 'medium', $carol, 'Done', null],
        ] as [$title, $priority, $creator, $col, $desc]) {
            $task = Task::create([
                'board_id' => $sprintBoard->id,
                'column_id' => $sprintCols[$col]->id,
                'task_number' => ++$taskNum,
                'title' => $title,
                'priority' => $priority,
                'description' => $desc,
                'sort_order' => $taskNum,
                'created_by' => $creator->id,
                'completed_at' => now()->subDays(rand(1, 5)),
                'effort_estimate' => rand(2, 8),
            ]);
            $sprintTasks[$title] = $task;
        }

        // In Review
        foreach ([
            ['Implement API v2 pagination', 'high', $bob, 'In Review', "Cursor-based pagination for all list endpoints.\n\n## Acceptance Criteria\n- Support `cursor` and `per_page` params\n- Return `next_cursor` in response\n- Default 25 items per page, max 100"],
        ] as [$title, $priority, $creator, $col, $desc]) {
            $task = Task::create([
                'board_id' => $sprintBoard->id,
                'column_id' => $sprintCols[$col]->id,
                'task_number' => ++$taskNum,
                'title' => $title,
                'priority' => $priority,
                'description' => $desc,
                'sort_order' => $taskNum,
                'created_by' => $creator->id,
                'effort_estimate' => 5,
            ]);
            $sprintTasks[$title] = $task;
        }

        // In Progress
        foreach ([
            ['Optimize database queries for dashboard', 'urgent', $admin, 'In Progress', "Dashboard loads slowly with many tasks. Profile and optimize N+1 queries.\n\nCurrent load time: ~2.3s\nTarget: <500ms"],
            ['Add WebSocket reconnection logic', 'medium', $dave, 'In Progress', 'Handle dropped connections gracefully. Auto-reconnect with exponential backoff.'],
        ] as [$title, $priority, $creator, $col, $desc]) {
            $task = Task::create([
                'board_id' => $sprintBoard->id,
                'column_id' => $sprintCols[$col]->id,
                'task_number' => ++$taskNum,
                'title' => $title,
                'priority' => $priority,
                'description' => $desc,
                'sort_order' => $taskNum,
                'created_by' => $creator->id,
                'effort_estimate' => rand(3, 8),
                'due_date' => now()->addDays(rand(1, 5)),
            ]);
            $sprintTasks[$title] = $task;
        }

        // To Do
        foreach ([
            ['Implement file upload size validation', 'medium', $carol, 'To Do', null],
            ['Add search functionality to task list', 'high', $admin, 'To Do', "Full-text search across task titles and descriptions.\n\nShould support:\n- Fuzzy matching\n- Label filtering\n- Assignee filtering"],
            ['Create API documentation with OpenAPI spec', 'low', $bob, 'To Do', null],
            ['Set up CI/CD pipeline for staging', 'medium', $dave, 'To Do', null],
        ] as [$title, $priority, $creator, $col, $desc]) {
            $task = Task::create([
                'board_id' => $sprintBoard->id,
                'column_id' => $sprintCols[$col]->id,
                'task_number' => ++$taskNum,
                'title' => $title,
                'priority' => $priority,
                'description' => $desc,
                'sort_order' => $taskNum,
                'created_by' => $creator->id,
                'due_date' => now()->addDays(rand(3, 14)),
                'effort_estimate' => rand(1, 5),
            ]);
            $sprintTasks[$title] = $task;
        }

        // Backlog
        foreach ([
            ['Migrate to PHP 8.4 named arguments', 'low', $admin, 'Backlog', null],
            ['Add dark mode to email templates', 'none', $eve, 'Backlog', null],
            ['Implement task archiving', 'low', $bob, 'Backlog', null],
        ] as [$title, $priority, $creator, $col, $desc]) {
            $task = Task::create([
                'board_id' => $sprintBoard->id,
                'column_id' => $sprintCols[$col]->id,
                'task_number' => ++$taskNum,
                'title' => $title,
                'priority' => $priority,
                'description' => $desc,
                'sort_order' => $taskNum,
                'created_by' => $creator->id,
            ]);
            $sprintTasks[$title] = $task;
        }

        // Assignees for sprint tasks
        $this->assignTask($sprintTasks['Set up OAuth2 provider integration'], [$admin, $carol], $admin);
        $this->assignTask($sprintTasks['Add rate limiting to API endpoints'], [$bob], $admin);
        $this->assignTask($sprintTasks['Write unit tests for auth actions'], [$carol], $bob);
        $this->assignTask($sprintTasks['Implement API v2 pagination'], [$bob, $dave], $admin);
        $this->assignTask($sprintTasks['Optimize database queries for dashboard'], [$admin], $admin);
        $this->assignTask($sprintTasks['Add WebSocket reconnection logic'], [$dave], $bob);
        $this->assignTask($sprintTasks['Implement file upload size validation'], [$carol], $admin);
        $this->assignTask($sprintTasks['Add search functionality to task list'], [$admin, $eve], $admin);
        $this->assignTask($sprintTasks['Set up CI/CD pipeline for staging'], [$dave], $dave);

        // Labels for sprint tasks
        $sprintTasks['Set up OAuth2 provider integration']->labels()->attach([$engLabels['Feature']->id, $engLabels['Backend']->id]);
        $sprintTasks['Add rate limiting to API endpoints']->labels()->attach([$engLabels['Enhancement']->id, $engLabels['Backend']->id]);
        $sprintTasks['Write unit tests for auth actions']->labels()->attach([$engLabels['Enhancement']->id]);
        $sprintTasks['Implement API v2 pagination']->labels()->attach([$engLabels['Feature']->id, $engLabels['Backend']->id]);
        $sprintTasks['Optimize database queries for dashboard']->labels()->attach([$engLabels['Urgent']->id, $engLabels['Backend']->id]);
        $sprintTasks['Add WebSocket reconnection logic']->labels()->attach([$engLabels['Enhancement']->id, $engLabels['Frontend']->id]);
        $sprintTasks['Add search functionality to task list']->labels()->attach([$engLabels['Feature']->id, $engLabels['Frontend']->id, $engLabels['Backend']->id]);
        $sprintTasks['Create API documentation with OpenAPI spec']->labels()->attach([$engLabels['Documentation']->id]);
        $sprintTasks['Set up CI/CD pipeline for staging']->labels()->attach([$engLabels['DevOps']->id]);
        $sprintTasks['Migrate to PHP 8.4 named arguments']->labels()->attach([$engLabels['Tech Debt']->id]);

        // Checklists
        $sprintTasks['Set up OAuth2 provider integration']->update([
            'checklists' => [
                [
                    'id' => Str::uuid()->toString(),
                    'title' => 'OAuth Setup',
                    'items' => [
                        ['id' => Str::uuid()->toString(), 'text' => 'Google OAuth setup', 'completed' => true],
                        ['id' => Str::uuid()->toString(), 'text' => 'GitHub OAuth setup', 'completed' => true],
                        ['id' => Str::uuid()->toString(), 'text' => 'Token refresh flow', 'completed' => true],
                        ['id' => Str::uuid()->toString(), 'text' => 'Account linking UI', 'completed' => false],
                    ],
                ],
            ],
        ]);

        $sprintTasks['Add search functionality to task list']->update([
            'checklists' => [
                [
                    'id' => Str::uuid()->toString(),
                    'title' => 'Implementation',
                    'items' => [
                        ['id' => Str::uuid()->toString(), 'text' => 'Backend search endpoint', 'completed' => false],
                        ['id' => Str::uuid()->toString(), 'text' => 'Frontend search UI', 'completed' => false],
                        ['id' => Str::uuid()->toString(), 'text' => 'Debounced input', 'completed' => false],
                        ['id' => Str::uuid()->toString(), 'text' => 'Highlight matches', 'completed' => false],
                        ['id' => Str::uuid()->toString(), 'text' => 'Filter integration', 'completed' => false],
                    ],
                ],
            ],
        ]);

        // Dependencies
        TaskDependency::create([
            'task_id' => $sprintTasks['Implement API v2 pagination']->id,
            'depends_on_task_id' => $sprintTasks['Add rate limiting to API endpoints']->id,
            'created_by' => $admin->id,
        ]);

        TaskDependency::create([
            'task_id' => $sprintTasks['Create API documentation with OpenAPI spec']->id,
            'depends_on_task_id' => $sprintTasks['Implement API v2 pagination']->id,
            'created_by' => $bob->id,
        ]);

        // Subtasks
        $parentTask = $sprintTasks['Set up CI/CD pipeline for staging'];
        foreach ([
            'Configure GitHub Actions workflow',
            'Set up staging environment variables',
            'Add Docker build step',
            'Configure deployment to staging server',
        ] as $i => $subtaskTitle) {
            Task::create([
                'board_id' => $sprintBoard->id,
                'column_id' => $sprintCols['To Do']->id,
                'task_number' => ++$taskNum,
                'title' => $subtaskTitle,
                'parent_task_id' => $parentTask->id,
                'priority' => 'medium',
                'sort_order' => $i,
                'created_by' => $dave->id,
            ]);
        }

        // Recurring task
        $sprintTasks['Add dark mode to email templates']->update([
            'recurrence_config' => ['frequency' => 'weekly', 'day' => 'monday'],
            'recurrence_next_at' => now()->next('Monday'),
        ]);

        $this->command->info('  ✓ Sprint board: 14 tasks + 4 subtasks, with labels, assignees, checklists, dependencies');

        // ── Bug Board Tasks ────────────────────────────────────
        $bugTaskNum = 0;
        $bugTasks = [];

        $bugDefs = [
            ['Login fails with special characters in password', 'urgent', $carol, 'Fixing', "Steps to reproduce:\n1. Create account with password containing `&` or `<`\n2. Try to log in\n3. Get 500 error\n\nLikely HTML encoding issue in the auth flow."],
            ['Drag and drop breaks on mobile Safari', 'high', $eve, 'Triaged', "Kanban drag-and-drop doesn't work on iPad Safari. Touch events not properly handled by dnd-kit.\n\niOS 17.4, Safari 17.4"],
            ['Column WIP limit not enforced on bulk move', 'medium', $bob, 'Triaged', null],
            ['Dark mode: unreadable text in notification dropdown', 'medium', $carol, 'Reported', 'Text color doesn\'t change in dark mode. Hardcoded color somewhere.'],
            ['WebSocket disconnects every 30 seconds on Firefox', 'high', $dave, 'Fixing', null],
            ['Task description markdown not rendering code blocks', 'low', $eve, 'Reported', null],
            ['API returns 500 on invalid UUID format', 'medium', $bob, 'Verifying', 'Should return 404/422 instead of 500 when malformed UUID is passed.'],
            ['Notification count badge shows negative number', 'low', $carol, 'Closed', null],
            ['Board settings modal doesn\'t close on Escape', 'low', $admin, 'Closed', null],
            ['File upload fails for files >10MB', 'medium', $dave, 'Reported', "Max upload size is supposed to be 25MB but anything over 10MB fails.\n\nProbably a PHP/nginx config issue."],
        ];

        foreach ($bugDefs as [$title, $priority, $creator, $col, $desc]) {
            $task = Task::create([
                'board_id' => $bugBoard->id,
                'column_id' => $bugCols[$col]->id,
                'task_number' => ++$bugTaskNum,
                'title' => $title,
                'priority' => $priority,
                'description' => $desc,
                'sort_order' => $bugTaskNum,
                'created_by' => $creator->id,
                'due_date' => $priority === 'urgent' ? now()->addDay() : ($priority === 'high' ? now()->addDays(3) : null),
                'completed_at' => $col === 'Closed' ? now()->subDays(rand(1, 7)) : null,
            ]);
            $task->labels()->attach([$engLabels['Bug']->id]);
            $bugTasks[] = $task;
        }

        $this->assignTask($bugTasks[0], [$bob], $admin);
        $this->assignTask($bugTasks[4], [$dave], $bob);
        $this->assignTask($bugTasks[6], [$bob], $admin);

        $this->command->info('  ✓ Bug tracker: 10 bugs across columns');

        // ── Backlog Board Tasks ────────────────────────────────
        $backlogTaskNum = 0;
        $backlogDefs = [
            ['Multi-language support (i18n)', 'medium', $admin, 'Ideas', 'Add support for en, es, fr, de, ja initially.'],
            ['Board-level permissions', 'high', $admin, 'Refined', 'Allow restricting boards to specific team members.'],
            ['Email integration - create tasks from email', 'medium', $bob, 'Ideas', null],
            ['Gantt chart view', 'low', $carol, 'Ideas', null],
            ['Slack integration', 'medium', $dave, 'Refined', 'Post task updates to Slack channels. Support slash commands.'],
            ['Custom fields for tasks', 'high', $admin, 'Ready', 'Allow teams to define custom fields (text, number, date, select).'],
            ['Time tracking', 'medium', $eve, 'Ideas', null],
            ['Bulk task operations', 'medium', $bob, 'Ready', 'Select multiple tasks and apply actions (move, label, assign, delete).'],
            ['API webhooks for external integrations', 'low', $dave, 'Refined', null],
            ['Mobile app (React Native)', 'low', $admin, 'Ideas', 'Long-term goal. Start with responsive web first.'],
            ['Import from Trello/Jira', 'medium', $carol, 'Ideas', null],
            ['Task time estimates vs actuals report', 'low', $eve, 'Won\'t Do', 'Decided to use external tools for time tracking.'],
        ];

        foreach ($backlogDefs as [$title, $priority, $creator, $col, $desc]) {
            Task::create([
                'board_id' => $backlogBoard->id,
                'column_id' => $backlogCols[$col]->id,
                'task_number' => ++$backlogTaskNum,
                'title' => $title,
                'priority' => $priority,
                'description' => $desc,
                'sort_order' => $backlogTaskNum,
                'created_by' => $creator->id,
            ]);
        }

        $this->command->info('  ✓ Backlog: 12 items');

        // ── Design Team Board ──────────────────────────────────
        $designBoard = Board::create([
            'team_id' => $designTeam->id,
            'name' => 'Design System v2',
            'description' => 'Redesigning the component library',
            'sort_order' => 0,
        ]);

        $designCols = [];
        foreach ([
            ['Exploration', '#ec4899', null, false, 0],
            ['Design', '#8b5cf6', 3, false, 1],
            ['Review', '#f59e0b', null, false, 2],
            ['Handoff', '#3b82f6', null, false, 3],
            ['Complete', '#10b981', null, true, 4],
        ] as [$name, $color, $wip, $done, $order]) {
            $designCols[$name] = Column::create([
                'board_id' => $designBoard->id,
                'name' => $name,
                'color' => $color,
                'wip_limit' => $wip,
                'is_done_column' => $done,
                'sort_order' => $order,
            ]);
        }

        $designTaskNum = 0;
        $designTaskDefs = [
            ['Design new color palette', 'high', $carol, 'Complete', 'WCAG AA compliant color system with semantic tokens.'],
            ['Typography scale', 'high', $carol, 'Complete', null],
            ['Button component variants', 'medium', $carol, 'Handoff', null],
            ['Form input components', 'medium', $eve, 'Design', null],
            ['Modal and dialog patterns', 'medium', $carol, 'Design', null],
            ['Navigation patterns', 'high', $eve, 'Review', null],
            ['Data table component', 'medium', $carol, 'Exploration', null],
            ['Toast notification design', 'low', $eve, 'Exploration', null],
            ['Empty state illustrations', 'low', $carol, 'Exploration', null],
            ['Dark mode token mapping', 'high', $eve, 'Design', 'Map all semantic color tokens to dark mode equivalents.'],
        ];

        $designTasks = [];
        foreach ($designTaskDefs as [$title, $priority, $creator, $col, $desc]) {
            $task = Task::create([
                'board_id' => $designBoard->id,
                'column_id' => $designCols[$col]->id,
                'task_number' => ++$designTaskNum,
                'title' => $title,
                'priority' => $priority,
                'description' => $desc,
                'sort_order' => $designTaskNum,
                'created_by' => $creator->id,
                'completed_at' => $col === 'Complete' ? now()->subDays(rand(1, 10)) : null,
                'due_date' => in_array($col, ['Design', 'Review']) ? now()->addDays(rand(2, 10)) : null,
                'effort_estimate' => rand(2, 8),
            ]);
            if (isset($designLabels[array_rand($designLabels)])) {
                $labelKeys = array_keys($designLabels);
                $task->labels()->attach($designLabels[$labelKeys[array_rand($labelKeys)]]->id);
            }
            $designTasks[] = $task;
        }

        $this->assignTask($designTasks[2], [$carol], $carol);
        $this->assignTask($designTasks[3], [$eve], $carol);
        $this->assignTask($designTasks[4], [$carol], $carol);
        $this->assignTask($designTasks[5], [$eve], $carol);
        $this->assignTask($designTasks[9], [$eve, $carol], $carol);

        $this->command->info('  ✓ Design board: 10 tasks');

        // ── Marketing Team Board ───────────────────────────────
        $marketingBoard = Board::create([
            'team_id' => $marketingTeam->id,
            'name' => 'Q1 Campaign',
            'description' => 'Q1 2026 marketing initiatives',
            'sort_order' => 0,
        ]);

        $mktCols = [];
        foreach ([
            ['Planning', '#94a3b8', null, false, 0],
            ['In Progress', '#3b82f6', null, false, 1],
            ['Review', '#f59e0b', null, false, 2],
            ['Published', '#10b981', null, true, 3],
        ] as [$name, $color, $wip, $done, $order]) {
            $mktCols[$name] = Column::create([
                'board_id' => $marketingBoard->id,
                'name' => $name,
                'color' => $color,
                'wip_limit' => $wip,
                'is_done_column' => $done,
                'sort_order' => $order,
            ]);
        }

        $mktTaskNum = 0;
        $mktDefs = [
            ['Write launch blog post', 'high', $dave, 'In Progress', null],
            ['Create social media graphics', 'medium', $eve, 'In Progress', null],
            ['Set up Google Analytics events', 'medium', $dave, 'Planning', null],
            ['Email newsletter - March edition', 'high', $eve, 'Review', null],
            ['Product demo video', 'medium', $dave, 'Planning', null],
            ['SEO audit and fixes', 'low', $eve, 'Planning', null],
            ['Landing page copy', 'high', $dave, 'Published', null],
            ['Press release draft', 'medium', $eve, 'Published', null],
        ];

        foreach ($mktDefs as [$title, $priority, $creator, $col, $desc]) {
            $task = Task::create([
                'board_id' => $marketingBoard->id,
                'column_id' => $mktCols[$col]->id,
                'task_number' => ++$mktTaskNum,
                'title' => $title,
                'priority' => $priority,
                'description' => $desc,
                'sort_order' => $mktTaskNum,
                'created_by' => $creator->id,
                'completed_at' => $col === 'Published' ? now()->subDays(rand(1, 7)) : null,
                'due_date' => $col !== 'Published' ? now()->addDays(rand(1, 14)) : null,
            ]);
            $labelKeys = array_keys($marketingLabels);
            $task->labels()->attach($marketingLabels[$labelKeys[array_rand($labelKeys)]]->id);
        }

        $this->command->info('  ✓ Marketing board: 8 tasks');

        // ── Comments ───────────────────────────────────────────
        $commentData = [
            [$sprintTasks['Optimize database queries for dashboard'], [
                [$admin, 'Profiled the dashboard - we have 47 queries on load. Main culprits are the task counts per column and the recent activity feed.'],
                [$bob, 'Have you tried eager loading the column relationships? That alone should cut it in half.'],
                [$admin, 'Good call. Eager loading + a single raw query for counts dropped it to 12 queries. Working on caching next.'],
                [$carol, "Can we add a Redis cache layer for the counts? They don't need to be real-time."],
                [$admin, "Yes, that's the plan. Going with a 60-second TTL. Will invalidate on task create/move/delete."],
            ]],
            [$sprintTasks['Implement API v2 pagination'], [
                [$bob, "Cursor pagination is implemented. Using the task's `created_at` + `id` as the cursor to avoid issues with duplicate timestamps."],
                [$dave, 'Looks good! One thing - should we support both cursor and offset pagination? Some clients might prefer offset.'],
                [$bob, "Let's stick with cursor only for v2. Offset pagination doesn't scale well with large datasets."],
                [$admin, 'Agreed. @dave can you test this with the mobile client?'],
            ]],
            [$sprintTasks['Add WebSocket reconnection logic'], [
                [$dave, 'Implemented exponential backoff: 1s, 2s, 4s, 8s, max 30s. Also shows a connection status indicator.'],
                [$admin, 'Nice. Does it resync missed events after reconnect?'],
                [$dave, "Not yet - that's the tricky part. We'd need server-side event buffering or a last-event-id mechanism."],
            ]],
            [$sprintTasks['Add search functionality to task list'], [
                [$admin, 'Planning to use Laravel Scout with the database driver for now. We can switch to Meilisearch later if needed.'],
                [$eve, 'Should search include comments and attachment filenames too?'],
                [$admin, "Good point - let's start with title + description, then expand in a follow-up."],
            ]],
            [$bugTasks[0], [
                [$carol, "Found the issue - we're using `htmlspecialchars()` on the password before hashing. The HTML entities get hashed instead of the actual password."],
                [$bob, 'Fixing now. This was introduced in the XSS prevention pass - we accidentally included the password field.'],
                [$admin, "Let's add a regression test for this. Special chars in passwords should be a standard test case."],
            ]],
            [$bugTasks[1], [
                [$eve, 'dnd-kit has a `TouchSensor` that needs to be explicitly configured. Currently only `PointerSensor` is set up.'],
                [$carol, "I'll add the touch sensor config. Also need to handle the long-press gesture to distinguish from scrolling."],
            ]],
        ];

        foreach ($commentData as [$task, $comments]) {
            foreach ($comments as $i => [$user, $body]) {
                Comment::create([
                    'task_id' => $task->id,
                    'user_id' => $user->id,
                    'body' => $body,
                    'created_at' => now()->subDays(5)->addHours($i * rand(2, 8)),
                    'updated_at' => now()->subDays(5)->addHours($i * rand(2, 8)),
                ]);
            }
        }

        $this->command->info('  ✓ 23 comments across tasks');

        // ── Activities ─────────────────────────────────────────
        $activities = [
            [$sprintTasks['Set up OAuth2 provider integration'], $admin, 'created', []],
            [$sprintTasks['Set up OAuth2 provider integration'], $admin, 'updated', ['priority' => ['medium', 'high']]],
            [$sprintTasks['Set up OAuth2 provider integration'], $admin, 'moved', ['column' => ['To Do', 'In Progress']]],
            [$sprintTasks['Set up OAuth2 provider integration'], $admin, 'moved', ['column' => ['In Progress', 'Done']]],
            [$sprintTasks['Optimize database queries for dashboard'], $admin, 'created', []],
            [$sprintTasks['Optimize database queries for dashboard'], $admin, 'updated', ['priority' => ['high', 'urgent']]],
            [$sprintTasks['Optimize database queries for dashboard'], $bob, 'assigned', ['assignee' => $admin->name]],
            [$sprintTasks['Implement API v2 pagination'], $admin, 'created', []],
            [$sprintTasks['Implement API v2 pagination'], $admin, 'moved', ['column' => ['To Do', 'In Progress']]],
            [$sprintTasks['Implement API v2 pagination'], $bob, 'moved', ['column' => ['In Progress', 'In Review']]],
            [$bugTasks[0], $carol, 'created', []],
            [$bugTasks[0], $admin, 'updated', ['priority' => ['high', 'urgent']]],
            [$bugTasks[0], $admin, 'moved', ['column' => ['Reported', 'Triaged']]],
            [$bugTasks[0], $admin, 'moved', ['column' => ['Triaged', 'Fixing']]],
        ];

        foreach ($activities as $i => [$task, $user, $action, $changes]) {
            Activity::create([
                'task_id' => $task->id,
                'user_id' => $user->id,
                'action' => $action,
                'changes' => $changes ?: null,
                'created_at' => now()->subDays(10)->addHours($i * 6),
            ]);
        }

        $this->command->info('  ✓ 14 activity records');

        // ── Attachments (fake media entries, no actual files) ────────
        $attachments = [
            [$sprintTasks['Set up OAuth2 provider integration'], $admin, 'oauth-flow-diagram.png', 245_000, 'image/png'],
            [$sprintTasks['Optimize database queries for dashboard'], $admin, 'query-profile-before.sql', 3_400, 'text/plain'],
            [$sprintTasks['Optimize database queries for dashboard'], $admin, 'query-profile-after.sql', 2_100, 'text/plain'],
            [$sprintTasks['Add search functionality to task list'], $admin, 'search-mockup.png', 180_000, 'image/png'],
            [$bugTasks[0], $carol, 'error-screenshot.png', 320_000, 'image/png'],
            [$bugTasks[1], $eve, 'ipad-recording.mp4', 4_500_000, 'video/mp4'],
            [$designTasks[0], $carol, 'color-palette-v2.figma', 890_000, 'application/octet-stream'],
        ];

        foreach ($attachments as [$task, $user, $filename, $size, $mime]) {
            DB::table('media')->insert([
                'model_type' => Task::class,
                'model_id' => $task->id,
                'uuid' => Str::uuid()->toString(),
                'collection_name' => 'attachments',
                'name' => pathinfo($filename, PATHINFO_FILENAME),
                'file_name' => $filename,
                'mime_type' => $mime,
                'disk' => 'local',
                'conversions_disk' => 'local',
                'size' => $size,
                'manipulations' => '[]',
                'custom_properties' => json_encode([
                    'original_filename' => $filename,
                    'uploaded_by' => $user->id,
                ]),
                'generated_conversions' => '[]',
                'responsive_images' => '[]',
                'order_column' => null,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        $this->command->info('  ✓ 7 attachments');

        // ── Saved Filters ──────────────────────────────────────
        SavedFilter::create([
            'board_id' => $sprintBoard->id,
            'user_id' => $admin->id,
            'name' => 'My Tasks',
            'filter_config' => ['assignees' => [$admin->id]],
            'is_default' => true,
        ]);

        SavedFilter::create([
            'board_id' => $sprintBoard->id,
            'user_id' => $admin->id,
            'name' => 'High Priority',
            'filter_config' => ['priorities' => ['urgent', 'high']],
        ]);

        SavedFilter::create([
            'board_id' => $sprintBoard->id,
            'user_id' => $bob->id,
            'name' => 'Needs Review',
            'filter_config' => ['columns' => [$sprintCols['In Review']->id]],
            'is_default' => true,
        ]);

        SavedFilter::create([
            'board_id' => $bugBoard->id,
            'user_id' => $admin->id,
            'name' => 'Open Bugs',
            'filter_config' => ['columns' => [$bugCols['Reported']->id, $bugCols['Triaged']->id, $bugCols['Fixing']->id]],
        ]);

        $this->command->info('  ✓ 4 saved filters');

        // ── Automation Rules ───────────────────────────────────
        AutomationRule::create([
            'board_id' => $sprintBoard->id,
            'name' => 'Auto-assign reviewer on In Review',
            'is_active' => true,
            'trigger_type' => 'task_moved',
            'trigger_config' => ['to_column_id' => $sprintCols['In Review']->id],
            'action_type' => 'assign_user',
            'action_config' => ['user_id' => $admin->id],
        ]);

        AutomationRule::create([
            'board_id' => $sprintBoard->id,
            'name' => 'Mark completed when moved to Done',
            'is_active' => true,
            'trigger_type' => 'task_moved',
            'trigger_config' => ['to_column_id' => $sprintCols['Done']->id],
            'action_type' => 'set_completed',
            'action_config' => [],
        ]);

        AutomationRule::create([
            'board_id' => $bugBoard->id,
            'name' => 'Add Urgent label on urgent priority',
            'is_active' => true,
            'trigger_type' => 'priority_changed',
            'trigger_config' => ['to_priority' => 'urgent'],
            'action_type' => 'add_label',
            'action_config' => ['label_id' => $engLabels['Urgent']->id],
        ]);

        AutomationRule::create([
            'board_id' => $sprintBoard->id,
            'name' => 'Notify on overdue (disabled)',
            'is_active' => false,
            'trigger_type' => 'task_overdue',
            'trigger_config' => [],
            'action_type' => 'notify_assignees',
            'action_config' => ['message' => 'Task is overdue!'],
        ]);

        $this->command->info('  ✓ 4 automation rules');

        // ── Task Templates ─────────────────────────────────────
        TaskTemplate::create([
            'team_id' => $engineeringTeam->id,
            'name' => 'Bug Report',
            'description_template' => "## Bug Description\n\n## Steps to Reproduce\n1. \n2. \n3. \n\n## Expected Behavior\n\n## Actual Behavior\n\n## Environment\n- Browser: \n- OS: \n\n## Screenshots\n",
            'priority' => 'medium',
            'effort_estimate' => 3,
            'checklists' => [
                [
                    'id' => Str::uuid()->toString(),
                    'title' => 'Bug Fix Steps',
                    'items' => [
                        ['id' => Str::uuid()->toString(), 'text' => 'Reproduce the bug', 'completed' => false],
                        ['id' => Str::uuid()->toString(), 'text' => 'Identify root cause', 'completed' => false],
                        ['id' => Str::uuid()->toString(), 'text' => 'Write fix', 'completed' => false],
                        ['id' => Str::uuid()->toString(), 'text' => 'Add regression test', 'completed' => false],
                    ],
                ],
            ],
            'label_ids' => [$engLabels['Bug']->id],
            'created_by' => $admin->id,
        ]);

        TaskTemplate::create([
            'team_id' => $engineeringTeam->id,
            'name' => 'Feature Request',
            'description_template' => "## Feature Description\n\n## User Story\nAs a [user type], I want [goal] so that [benefit].\n\n## Acceptance Criteria\n- [ ] \n\n## Technical Notes\n",
            'priority' => 'none',
            'effort_estimate' => null,
            'checklists' => null,
            'label_ids' => [$engLabels['Feature']->id],
            'created_by' => $admin->id,
        ]);

        TaskTemplate::create([
            'team_id' => $engineeringTeam->id,
            'name' => 'Tech Debt Cleanup',
            'description_template' => "## What needs cleaning up\n\n## Why now\n\n## Approach\n\n## Risk assessment\n",
            'priority' => 'low',
            'effort_estimate' => 5,
            'checklists' => null,
            'label_ids' => [$engLabels['Tech Debt']->id],
            'created_by' => $bob->id,
        ]);

        $this->command->info('  ✓ 3 task templates');

        // ── Board Templates ────────────────────────────────────
        BoardTemplate::create([
            'name' => 'Sprint Board',
            'description' => 'Standard sprint board with Backlog, To Do, In Progress, Review, Done',
            'created_by' => $admin->id,
            'template_data' => [
                'columns' => [
                    ['name' => 'Backlog', 'color' => '#94a3b8'],
                    ['name' => 'To Do', 'color' => '#6366f1', 'wip_limit' => 5],
                    ['name' => 'In Progress', 'color' => '#f59e0b', 'wip_limit' => 3],
                    ['name' => 'In Review', 'color' => '#8b5cf6', 'wip_limit' => 2],
                    ['name' => 'Done', 'color' => '#10b981', 'is_done_column' => true],
                ],
            ],
        ]);

        BoardTemplate::create([
            'name' => 'Simple Kanban',
            'description' => 'Minimal 3-column board',
            'created_by' => $admin->id,
            'template_data' => [
                'columns' => [
                    ['name' => 'To Do', 'color' => '#6366f1'],
                    ['name' => 'Doing', 'color' => '#f59e0b'],
                    ['name' => 'Done', 'color' => '#10b981', 'is_done_column' => true],
                ],
            ],
        ]);

        $this->command->info('  ✓ 2 board templates');

        // ── Notifications (database channel) ───────────────────
        $notifications = [
            [$bob, 'App\Notifications\TaskAssignedNotification', [
                'type' => 'task_assigned',
                'task_id' => $sprintTasks['Implement API v2 pagination']->id,
                'task_title' => 'Implement API v2 pagination',
                'board_id' => $sprintBoard->id,
                'team_id' => $engineeringTeam->id,
                'assigner_name' => $admin->name,
                'message' => $admin->name.' assigned you to "Implement API v2 pagination"',
            ], null],
            [$admin, 'App\Notifications\TaskCommentedNotification', [
                'type' => 'task_commented',
                'task_id' => $sprintTasks['Optimize database queries for dashboard']->id,
                'task_title' => 'Optimize database queries for dashboard',
                'board_id' => $sprintBoard->id,
                'team_id' => $engineeringTeam->id,
                'commenter_name' => $bob->name,
                'comment_preview' => 'Have you tried eager loading the column relationships?',
                'message' => $bob->name.' commented on "Optimize database queries for dashboard": Have you tried eager loading the column relationships?',
            ], null],
            [$dave, 'App\Notifications\TaskAssignedNotification', [
                'type' => 'task_assigned',
                'task_id' => $sprintTasks['Add WebSocket reconnection logic']->id,
                'task_title' => 'Add WebSocket reconnection logic',
                'board_id' => $sprintBoard->id,
                'team_id' => $engineeringTeam->id,
                'assigner_name' => $bob->name,
                'message' => $bob->name.' assigned you to "Add WebSocket reconnection logic"',
            ], now()->subHours(3)],
            [$admin, 'App\Notifications\TaskDueSoonNotification', [
                'type' => 'task_due_soon',
                'task_id' => $sprintTasks['Optimize database queries for dashboard']->id,
                'task_title' => 'Optimize database queries for dashboard',
                'board_id' => $sprintBoard->id,
                'team_id' => $engineeringTeam->id,
                'due_date' => now()->addDays(2)->toDateString(),
                'board_name' => 'Sprint 24 - Q1 2026',
                'message' => '"Optimize database queries for dashboard" is due in 2 days',
            ], null],
            [$carol, 'App\Notifications\TaskMentionedNotification', [
                'type' => 'task_mentioned',
                'task_id' => $sprintTasks['Implement API v2 pagination']->id,
                'task_title' => 'Implement API v2 pagination',
                'board_id' => $sprintBoard->id,
                'team_id' => $engineeringTeam->id,
                'mentioner_name' => $admin->name,
                'comment_preview' => '@carol can you test this with the mobile client?',
                'message' => $admin->name.' mentioned you in "Implement API v2 pagination": @carol can you test this with the mobile client?',
            ], now()->subDay()],
        ];

        foreach ($notifications as [$user, $type, $data, $readAt]) {
            DB::table('notifications')->insert([
                'id' => Str::uuid()->toString(),
                'type' => $type,
                'notifiable_type' => 'App\Models\User',
                'notifiable_id' => $user->id,
                'data' => json_encode($data),
                'read_at' => $readAt,
                'created_at' => now()->subHours(rand(1, 48)),
                'updated_at' => now()->subHours(rand(1, 48)),
            ]);
        }

        $this->command->info('  ✓ 5 notifications (2 read, 3 unread)');

        // ── Summary ────────────────────────────────────────────
        $this->command->newLine();
        $this->command->info('Demo data seeding complete!');
        $this->command->newLine();
        $this->command->table(
            ['Resource', 'Count'],
            [
                ['Users', '6 (+ 1 bot)'],
                ['Teams', '3'],
                ['Boards', '6 (1 archived)'],
                ['Columns', '22'],
                ['Tasks', (string) Task::count()],
                ['Labels', (string) Label::count()],
                ['Comments', (string) Comment::count()],
                ['Activities', (string) Activity::count()],
                ['Attachments', (string) Media::where('collection_name', 'attachments')->count()],
                ['Saved Filters', (string) SavedFilter::count()],
                ['Automation Rules', (string) AutomationRule::count()],
                ['Task Templates', (string) TaskTemplate::count()],
                ['Board Templates', (string) BoardTemplate::count()],
                ['Notifications', (string) DB::table('notifications')->count()],
            ]
        );
        $this->command->newLine();
        $this->command->info('Login credentials (all passwords: "password"):');
        $this->command->table(
            ['Email', 'Role', 'Notes'],
            [
                ['alice@demo.test', 'Admin', 'Site admin, owner of Engineering team'],
                ['bob@demo.test', 'User', 'Admin of Engineering team'],
                ['carol@demo.test', 'User', 'Owner of Design team'],
                ['dave@demo.test', 'User', 'Owner of Marketing team'],
                ['eve@demo.test', 'User', 'Member across teams'],
            ]
        );
    }

    private function assignTask(Task $task, array $users, User $assigner): void
    {
        foreach ($users as $user) {
            DB::table('task_assignees')->insert([
                'id' => Str::uuid()->toString(),
                'task_id' => $task->id,
                'user_id' => $user->id,
                'assigned_at' => now(),
                'assigned_by' => $assigner->id,
            ]);
        }
    }
}
