# PulseBoard

A self-hosted Kanban project management application with GitLab integration, real-time collaboration, and enterprise SSO support.

## Tech Stack

- **Backend:** Laravel 12, PHP 8.2+
- **Frontend:** React 18, TypeScript, Inertia.js v2, MUI v6
- **Database:** MySQL 8.0
- **Cache/Queue:** Redis 7
- **Real-time:** Laravel Reverb (WebSocket server), Laravel Echo
- **Auth:** Laravel Breeze + SAML2 SSO (onelogin/php-saml)

## Features

- Kanban boards with drag-and-drop task management
- 5 board views: Kanban, List, Calendar, Timeline, Workload
- Team management with role-based access (owner/admin/member)
- Real-time collaboration with WebSocket presence indicators
- GitLab integration (branches, merge requests, webhooks, pipeline status)
- Automation engine for workflow rules
- Board templates for quick setup
- SAML2 SSO with JIT user provisioning
- In-app and email notifications with configurable preferences
- Personal and team dashboards with analytics
- Dark/light theme support
- Admin panel for user, team, and organization management

## Prerequisites

- PHP 8.2+
- Composer
- Node.js 18+ and npm
- MySQL 8.0
- Redis 7

## Quick Start

### Using Docker (recommended)

```bash
git clone <repo-url> pulseboard
cd pulseboard
cp .env.example .env
docker-compose up -d
docker-compose exec app composer setup
```

The app will be available at `http://localhost:8000`.

### Local Development

```bash
git clone <repo-url> pulseboard
cd pulseboard
composer setup       # Install deps, generate .env, run migrations, build frontend
composer dev         # Start all dev services (Laravel, Vite HMR, queue, Reverb)
```

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
composer dev                    # Start all dev services
./vendor/bin/pint               # PHP code formatting (PSR-12)
npx tsc --noEmit                # TypeScript type checking
npx vite build                  # Production frontend build
```

## Testing

Tests run inside a dedicated Docker container that provides the correct isolated environment (SQLite in-memory DB, array sessions, sync queue). **Do not** run tests directly via `composer test`, inside the `app` container, or on the host — the `.env` file sets `SESSION_DRIVER=redis` and `DB_CONNECTION=mysql`, which will cause CSRF (419) and connection errors.

```bash
# Run the full test suite
docker compose --profile test run --rm test

# Run a specific test class
docker compose --profile test run --rm test --filter=TaskControllerTest

# Run a specific test file
docker compose --profile test run --rm test tests/Feature/Api/V1/ApiAuthTest.php

# Run tests with verbose output
docker compose --profile test run --rm test --verbose
```

The test container is defined in `docker-compose.yml` under the `test` profile and uses `docker/Dockerfile.dev` — a lightweight PHP 8.4 image with SQLite, MySQL, and Redis extensions. It sets `APP_ENV=testing`, `DB_CONNECTION=sqlite`, and `DB_DATABASE=:memory:` to match `phpunit.xml`.

**Note:** After adding new routes or controllers, reload Octane workers so the running dev app picks up changes:

```bash
docker compose exec app php artisan octane:reload
```

## Architecture Overview

### Backend

- **Actions pattern:** Business logic in `app/Actions/`, controllers are thin wrappers
- **Authorization:** Route middleware (`team.member`, `admin`) + Laravel Policies
- **Models:** UUID primary keys, `$guarded = []` (validation in Form Requests)
- **Broadcasting:** Laravel Reverb, events dispatched via `BoardChanged` event
- **Notifications:** Database + mail channels, preferences stored as JSON on User model

### Frontend

- **Inertia.js** bridges Laravel routes to React page components (`resources/js/Pages/`)
- **MUI v6** for all UI components, styled via `sx` prop
- **Theme** context with light/dark/system mode support
- **WebSocket** context provides Echo instance for real-time features
- **TypeScript** interfaces for all backend models in `resources/js/types/index.d.ts`

## Production Deployment

1. **Build frontend assets:**
   ```bash
   npm ci && npx vite build
   ```

2. **Configure environment:**
   ```bash
   cp .env.example .env
   # Edit .env with production values
   php artisan key:generate
   php artisan migrate --force
   ```

3. **Run queue workers** (for notifications, GitLab sync, automation):
   ```bash
   php artisan queue:work redis --sleep=3 --tries=3
   ```

4. **Run WebSocket server** (for real-time features):
   ```bash
   php artisan reverb:start
   ```

5. **Schedule tasks** (for due date reminders, overdue alerts):
   ```bash
   # Add to crontab:
   * * * * * cd /path/to/pulseboard && php artisan schedule:run >> /dev/null 2>&1
   ```

6. **Optimize for production:**
   ```bash
   php artisan config:cache
   php artisan route:cache
   php artisan view:cache
   php artisan event:cache
   ```

## Docker Production

The included `docker-compose.yml` runs the app with:
- FrankenPHP via Laravel Octane (port 8000)
- MySQL 8.0 (port 3306)
- Redis 7 (port 6379)
- Laravel Reverb (port 8080/9080)
- Queue worker and scheduler via Supervisor

## License

This project is licensed under the [GNU General Public License v3.0](LICENSE).
