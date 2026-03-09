<p align="center">
  <img src="public/favicon.svg" width="80" alt="PulseBoard logo" />
</p>

<h1 align="center">PulseBoard</h1>

<p align="center">
  A self-hosted Kanban project management application with GitLab integration, real-time collaboration, and enterprise SSO support.
</p>

## Tech Stack

- **Backend:** Laravel 12, PHP 8.2+
- **Frontend:** React 18, TypeScript, Inertia.js v2, MUI v6
- **Database:** MySQL 8.0
- **Cache/Queue:** Redis 7
- **Real-time:** Laravel Reverb (WebSocket), Laravel Echo
- **Server:** FrankenPHP via Laravel Octane
- **Auth:** Laravel Breeze + SAML2 SSO (onelogin/php-saml)

## Features

### Boards & Tasks
- Kanban boards with drag-and-drop task management
- 5 board views: Kanban, List, Calendar, Timeline, Workload
- Cross-board task moves within a team
- Subtasks, checklists, and task dependencies (blocked-by / blocking)
- Task recurrence (daily, weekly, monthly, custom)
- Priority levels, due dates, effort estimates, and custom fields
- File attachments with drag-and-drop upload
- Rich text descriptions with inline image support

### Templates & Automation
- Task templates for quick creation with pre-configured defaults
- Board templates to replicate board structures
- Default task template per board (auto-applies on new tasks)
- Saved filters per board with default filter auto-apply
- Automation engine for workflow rules (trigger/action based)
- Column WIP limits to enforce work-in-progress constraints

### Collaboration
- Real-time updates via WebSocket (task changes, comments, moves)
- Presence indicators showing who's viewing a board
- Comments and activity feed on tasks
- In-app and email notifications with configurable preferences
- Team management with role-based access (owner / admin / member)

### Integrations
- GitLab integration: branches, merge requests, webhooks, pipeline status
- Auto-linking GitLab MRs to tasks via branch naming convention
- Background sync of GitLab link states
- REST API with Sanctum token auth (v1)

### Administration
- Admin panel with dashboard, user management, and team oversight
- SAML2 SSO with JIT (just-in-time) user provisioning
- Bot user creation scoped to teams (for API integrations)
- CSV export of team tasks
- Dark / light / system theme support

## Quick Start

### Docker (recommended)

```bash
git clone <repo-url> pulseboard
cd pulseboard
cp .env.example .env
docker compose up -d
docker compose exec app composer setup
```

The app is available at `http://localhost:8000`.

### Demo Data

Seed the database with sample teams, boards, and tasks:

```bash
docker compose exec app php artisan db:seed --class=DemoSeeder
```

Default login: `alice@demo.test` / `password`

### Local Development (without Docker)

```bash
git clone <repo-url> pulseboard
cd pulseboard
composer setup       # Install deps, generate .env + app key, run migrations, build frontend
composer dev         # Start Laravel, Vite HMR, queue worker, Reverb, and log tail
```

Requires PHP 8.2+, Composer, Node.js 18+, MySQL 8.0, and Redis 7 running locally.

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `APP_URL` | Application URL | `http://localhost:8000` |
| `DB_CONNECTION` | Database driver | `mysql` |
| `DB_HOST` | Database host | `127.0.0.1` |
| `DB_PORT` | Database port | `3306` |
| `DB_DATABASE` | Database name | `pulseboard` |
| `DB_USERNAME` | Database user | `root` |
| `DB_PASSWORD` | Database password | |
| `REDIS_HOST` | Redis host | `127.0.0.1` |
| `REDIS_PORT` | Redis port | `6379` |
| `REVERB_APP_ID` | Reverb WebSocket app ID | |
| `REVERB_APP_KEY` | Reverb WebSocket app key | |
| `REVERB_APP_SECRET` | Reverb WebSocket app secret | |
| `REVERB_HOST` | Reverb host | `localhost` |
| `REVERB_PORT` | Reverb port | `8080` |
| `MAIL_MAILER` | Mail driver | `smtp` |
| `MAIL_HOST` | SMTP host | |
| `MAIL_PORT` | SMTP port | `587` |

## Development Commands

```bash
composer dev                    # Start all dev services (Octane, Vite, queue, Reverb, logs)
./vendor/bin/pint               # PHP code formatting (PSR-12)
npx tsc --noEmit                # TypeScript type checking
npx vite build                  # Production frontend build
```

After adding or changing routes/controllers, reload the Octane workers:

```bash
docker compose exec app php artisan octane:reload
```

## Testing

Tests run inside a dedicated Docker container with an isolated environment (SQLite in-memory, array sessions, sync queue). **Do not** run tests directly on the host or in the `app` container — the `.env` overrides will cause CSRF (419) and connection errors.

```bash
# Full test suite
docker compose --profile test run --rm test

# Specific test class
docker compose --profile test run --rm test --filter=TaskControllerTest

# Specific test file
docker compose --profile test run --rm test tests/Feature/Api/V1/ApiAuthTest.php

# Verbose output
docker compose --profile test run --rm test --verbose
```

## Architecture

### Backend

- **Actions pattern:** Business logic lives in `app/Actions/`, controllers are thin wrappers that validate, authorize, and delegate
- **Authorization:** `team.member` route middleware + Laravel Policies (`TeamPolicy`, `BoardPolicy`) with owner/admin/member role checks
- **Models:** UUID primary keys (`HasUuids` trait), `$guarded = []` with validation in Form Requests
- **Broadcasting:** Single `BoardChanged` event on private channels, dispatched from `ActivityLogger` and action classes
- **Notifications:** Database + mail channels, user preferences in `email_notification_prefs` JSON column
- **Scheduled commands:** Due date reminders (hourly), overdue alerts (daily 9am), GitLab link sync (every 15min), recurring task processing (daily)

### Frontend

- **Inertia.js** bridges Laravel routes to React page components in `resources/js/Pages/`
- **MUI v6** for all UI — no Tailwind. Components styled via `sx` prop
- **Theme** context with light/dark/system mode (`resources/js/Contexts/ThemeContext.tsx`)
- **WebSocket** context provides Echo instance and connection status for real-time features
- **TypeScript** interfaces for all backend models in `resources/js/types/index.d.ts`
- **Path alias:** `@/*` maps to `resources/js/*`

### API

A REST API is available at `/api/v1/` authenticated via Sanctum personal access tokens. Endpoints cover teams, boards, tasks, and comments. Tokens can be created from the user profile or via the admin panel for bot users.

## Production Deployment

1. **Build frontend assets:**
   ```bash
   npm ci && npx vite build
   ```

2. **Configure environment:**
   ```bash
   cp .env.example .env
   # Edit .env with production values (DB, Redis, mail, Reverb, APP_URL)
   php artisan key:generate
   php artisan migrate --force
   ```

3. **Optimize for production:**
   ```bash
   php artisan config:cache
   php artisan route:cache
   php artisan view:cache
   php artisan event:cache
   ```

4. **Run services:**
   ```bash
   # Queue worker (notifications, GitLab sync, automation)
   php artisan queue:work redis --sleep=3 --tries=3

   # WebSocket server (real-time collaboration)
   php artisan reverb:start

   # Scheduler (add to crontab)
   * * * * * cd /path/to/pulseboard && php artisan schedule:run >> /dev/null 2>&1
   ```

### Docker Production

The included `docker-compose.yml` runs everything in containers:

| Service | Port | Description |
|---------|------|-------------|
| `app` | 8000 | FrankenPHP via Octane (web, queue worker, scheduler, Reverb) |
| `mysql` | 3306 | MySQL 8.0 |
| `redis` | 6379 | Redis 7 |

Reverb WebSocket is exposed on port **9080** (mapped from container port 8080).

The app container uses Supervisor (`docker/supervisord.conf`) to manage Octane, the queue worker, the scheduler, and the Reverb server as a single unit.

## License

This project is licensed under the [GNU General Public License v3.0](LICENSE).
