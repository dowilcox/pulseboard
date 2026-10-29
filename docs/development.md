# Development Guide

This guide is for people changing PulseBoard's code. The canonical, more detailed architecture notes live in [`CLAUDE.md`](../CLAUDE.md); this page summarizes them and adds the practical workflows.

## Architecture at a glance

| Layer         | Where                                                                                                | Notes                                                                                                                                       |
| ------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Routes        | `routes/web.php` → `routes/web/*.php`, `routes/api.php`, `routes/channels.php`, `routes/console.php` | Web URLs are slug-based (`/{team}/{board}/...`). **Registration order matters**: fixed paths must be registered before the slug catch-alls. |
| Controllers   | `app/Http/Controllers/` (`Admin/`, `Api/V1/`, `Auth/`)                                               | Thin: validate, authorize, call an Action, return an Inertia page, redirect, or JSON.                                                       |
| Form Requests | `app/Http/Requests/`                                                                                 | Validation. `authorize()` returns `true`; authorization happens in controllers.                                                             |
| Actions       | `app/Actions/{Teams,Boards,Tasks,Gitlab,Figma,Automation,Media}/`                                    | Business logic, one `handle()` per class, `AsAction` trait (`lorisleiva/laravel-actions`). Called with `SomeAction::run(...)`.              |
| Policies      | `app/Policies/`                                                                                      | `TeamPolicy`, `BoardPolicy`, `TaskPolicy`, `CommentPolicy`, sharing `Concerns/ChecksTeamRoles`.                                             |
| Services      | `app/Services/`                                                                                      | `ActivityLogger`, `TaskActivityNotifier`, `TaskAutomationDispatcher`, `MentionParser`, GitLab/Figma API clients, `SamlService`.             |
| Models        | `app/Models/`                                                                                        | UUID keys (`HasUuids`), `$guarded = []`. Team/Board bind by slug (or UUID), Task by number within the board.                                |
| Frontend      | `resources/js/`                                                                                      | Inertia v3 + React 19 + TypeScript + MUI v6 (no Tailwind). Pages in `Pages/`, types in `types/index.d.ts`, Harbor theme in `theme/`.        |

### The activity pipeline

Most task changes go through `ActivityLogger::log($task, $action, $changes, $actor)`. It writes an `activities` row and fires `TaskActivityLogged`, which has three listeners (`app/Providers/EventServiceProvider.php`; event discovery is off):

1. `BroadcastTaskActivity` broadcasts `BoardChanged` to `private-board.{id}` (`toOthers()`).
2. `DispatchTaskActivityNotifications` sends notifications through `TaskActivityNotifier`.
3. `RunTaskActivityAutomations` runs automation rules through `TaskAutomationDispatcher` (depth-limited to 3).

When you add a task mutation, log it through `ActivityLogger` so it is broadcast, notified and automatable. Deletions and some updates broadcast `BoardChanged` directly instead (see `DeleteTask`, `DeleteComment`, `MoveTask`).

`BoardChanged` and `NotificationCreated` implement `ShouldBroadcast`, so they go through the queue. Nothing else is queued.

## Local setup

### Docker (recommended)

```bash
cp .env.example .env
# docker-compose.yml requires these to be set in .env:
#   DB_PASSWORD, REVERB_APP_KEY, REVERB_APP_SECRET
docker compose up -d
```

- App: `http://localhost:8000`. MySQL on `3306`, Redis on `6379`. Reverb (WebSockets) on `8080`, or `VITE_REVERB_PORT` if you set it (see [Real-time](real-time.md#ports-in-the-docker-compose-files)).
- On first start the entrypoint installs Composer and npm dependencies, builds the frontend, generates `APP_KEY`, runs migrations and caches config. It rebuilds assets when frontend sources are newer than the last build.
- The development image runs Octane with `--watch`, Reverb, a queue worker and `schedule:work` under Supervisor.
- Demo data: `docker compose exec app php artisan db:seed --class=DemoSeeder` (login `alice@demo.test` / `password`).

### Without Docker

Requires PHP 8.5+, Composer, Node.js 24, MySQL 8.4 and Redis 8.

```bash
composer setup   # composer install, .env, key, migrate, npm install, npm run build
composer dev     # php artisan serve + queue:listen + pail (logs) + vite
```

`composer dev` does not start Reverb or the scheduler. Run `php artisan reverb:start` (and `php artisan schedule:work` if you need scheduled commands) in separate terminals.

### Octane reloads

The app runs under Octane, which keeps workers in memory. After changing routes, adding controllers, or editing PHP the running app must pick up, reload the workers:

```bash
docker compose exec app php artisan octane:reload
```

The dev container watches files, but reload manually if a change doesn't show up. Ziggy routes are served by the `@routes` Blade directive, so new routes reach the frontend after a reload, with no generated `ziggy.js` to rebuild.

## Tests

### Backend (PHPUnit)

Run backend tests **only** in the Docker test container:

```bash
docker compose --profile test build test                               # first run, or after Dockerfile changes
docker compose --profile test run --rm test                            # whole suite
docker compose --profile test run --rm test --filter=TaskControllerTest
docker compose --profile test run --rm test tests/Feature/MoveTaskTest.php
```

Why: the suite expects an isolated environment (SQLite in memory, array cache and sessions, sync queue). The test container sets those variables, points Laravel's config, package and service caches at `/tmp`, and clears caches before running. Running tests on the host or in the `app` container picks up the development `.env` and cached config instead (for example `SESSION_DRIVER=redis`), which shows up as `419` CSRF failures. Don't use `composer test` or `docker compose exec app php artisan test`.

Tests live in `tests/Feature/` and `tests/Unit/`, extending `Tests\TestCase`. Config is in `phpunit.xml`.

### Frontend (Vitest)

```bash
npm run test:run                          # all frontend tests, single run
npm run test:run -- richTextMarkdown      # filter by file name
npm test                                  # watch mode
docker compose --profile test run --rm test npm run test:run   # inside the test container
```

Tests sit next to the code as `*.test.ts(x)`, use jsdom, and share `resources/js/test/setup.ts`. Config is the `test` block in `vite.config.ts`.

## Code style and checks

```bash
./vendor/bin/pint          # PHP formatting (Laravel preset, PSR-12 based); CI runs pint --test
npx tsc --noEmit           # TypeScript type check
npx vite build             # production build
```

CI (`.github/workflows/`) runs type checking, frontend tests, Pint, the frontend build, `composer audit`, `npm audit` and the PHP test suite.

Conventions:

- PHP: snake_case columns, UUID primary keys, `$guarded = []`, validation in Form Requests.
- TypeScript/React: PascalCase components, camelCase functions, the `@/` alias for `resources/js/`.
- Styling: MUI components and the `sx` prop only. Import Grid from `@mui/material/Grid2` and use `size={{ xs: 12, md: 6 }}`. Use the Harbor tokens from `resources/js/theme/harbor.ts`.
- User-submitted rich text must go through `App\Support\RichTextSanitizer` on the server.
- Commits: conventional commits (`feat:`, `fix:`, `docs:`, `chore:`).

## Recipes

### Add a page

1. Create the Action, for example `app/Actions/Boards/DoThing.php`:

    ```php
    class DoThing
    {
        use AsAction;

        public function handle(Board $board, array $data): Board
        {
            // business logic
            return $board;
        }
    }
    ```

2. Add a Form Request in `app/Http/Requests/` for validation.
3. Add or extend a controller. Authorize with a policy, call the Action, and return a response:

    ```php
    public function store(DoThingRequest $request, Team $team, Board $board): RedirectResponse
    {
        $this->authorize('update', $board);
        DoThing::run($board, $request->validated());
        return Redirect::back()->with('success', 'Done.');
    }
    ```

4. Register the route in the right file under `routes/web/`. Team- and board-scoped routes go in `team-fixed.php` or `board-scoped.php`, which run behind the `team.member` middleware. A new **fixed** path such as `/reports` must be registered before the slug includes (see the comments in `routes/web.php`), or it will be captured as a team slug. Follow the route-name pattern (`teams.boards.columns.store`).
5. For a new page, render it with `Inertia::render('Area/Name', $props)` and create `resources/js/Pages/Area/Name.tsx`. Type the props, add any new model fields to `resources/js/types/index.d.ts`, and link to it with `route('name', params)`.
6. Reload Octane, then add a Feature test (and a Vitest test for non-trivial frontend logic).

### Add an API endpoint

Add the route to `routes/api.php` inside the `v1` group. Put team-scoped routes inside the `EnsureTeamMember` group and mutations inside the `abilities:write` or `abilities:manage` group (see the comment at the top of the file). Reuse the same Action as the web controller so behaviour matches, return `{"data": ...}`, and document it in [api.md](api.md).

### Add an automation trigger or action

Keep these in sync:

1. `AutomationRule::TRIGGER_TYPES` / `ACTION_TYPES` (`app/Models/AutomationRule.php`).
2. The matcher or executor in `app/Actions/Automation/ExecuteAutomationRules.php`.
3. Config validation in `app/Http/Requests/AutomationRuleRequest.php`.
4. Where the trigger fires: the activity-to-trigger map in `TaskAutomationDispatcher`, or a `dispatchTrigger()` call for events that don't come from the activity log.
5. The UI lists and config fields in `resources/js/Components/Automation/AutomationRulesPanel.tsx` and the summary text in `describeRule.ts`.
6. [automation.md](automation.md).

## Related docs

- [CLAUDE.md](../CLAUDE.md): architecture notes and commands.
- [MUI upgrade guide](mui-upgrade-guide.md): planned MUI v6 → v9 upgrade (not started).
- [REST API](api.md), [Real-time](real-time.md), [Administration](administration.md).
