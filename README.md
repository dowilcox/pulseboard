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
- File attachments with drag-and-drop upload (up to 15 MB per file)
- Rich text descriptions with inline image support (up to 5 MB per image)

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
- Figma integration: link designs to tasks with live previews
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
```

The entrypoint automatically installs dependencies, runs migrations, and builds frontend assets on first start. The app is available at `http://localhost:8000`.

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

### Application

| Variable    | Description                                           | Default                 |
| ----------- | ----------------------------------------------------- | ----------------------- |
| `APP_NAME`  | Application display name                              | `PulseBoard`            |
| `APP_ENV`   | Environment (`local`, `production`, `staging`)        | `local`                 |
| `APP_KEY`   | Encryption key (auto-generated)                       |                         |
| `APP_DEBUG` | Enable debug mode (**must be `false` in production**) | `true`                  |
| `APP_URL`   | Full public URL (e.g. `https://board.example.com`)    | `http://localhost:8000` |

### Server (Octane)

| Variable         | Description                       | Default      |
| ---------------- | --------------------------------- | ------------ |
| `OCTANE_SERVER`  | Octane server driver              | `frankenphp` |
| `OCTANE_HTTPS`   | Force HTTPS URL generation        | `false`      |
| `OCTANE_WORKERS` | Number of Octane worker processes | `4`          |

### Database

| Variable        | Description                       | Default      |
| --------------- | --------------------------------- | ------------ |
| `DB_CONNECTION` | Database driver                   | `mysql`      |
| `DB_HOST`       | Database host (`mysql` in Docker) | `127.0.0.1`  |
| `DB_PORT`       | Database port                     | `3306`       |
| `DB_DATABASE`   | Database name                     | `pulseboard` |
| `DB_USERNAME`   | Database user                     | `pulseboard` |
| `DB_PASSWORD`   | Database password                 | `secret`     |

### Redis

| Variable         | Description                        | Default     |
| ---------------- | ---------------------------------- | ----------- |
| `REDIS_HOST`     | Redis host (`redis` in Docker)     | `127.0.0.1` |
| `REDIS_PORT`     | Redis port                         | `6379`      |
| `REDIS_PASSWORD` | Redis password (set in production) | `null`      |

### Session

| Variable                | Description                               | Default |
| ----------------------- | ----------------------------------------- | ------- |
| `SESSION_DRIVER`        | Session backend                           | `redis` |
| `SESSION_LIFETIME`      | Session lifetime in minutes               | `120`   |
| `SESSION_DOMAIN`        | Cookie domain (e.g. `.example.com`)       | `null`  |
| `SESSION_SECURE_COOKIE` | Require HTTPS for cookies                 | `false` |
| `SESSION_SAME_SITE`     | SameSite policy (`lax`, `strict`, `none`) | `lax`   |

### Cache & Queue

| Variable               | Description      | Default  |
| ---------------------- | ---------------- | -------- |
| `CACHE_STORE`          | Cache backend    | `redis`  |
| `QUEUE_CONNECTION`     | Queue backend    | `redis`  |
| `BROADCAST_CONNECTION` | Broadcast driver | `reverb` |

### Mail

| Variable            | Description                                    | Default                    |
| ------------------- | ---------------------------------------------- | -------------------------- |
| `MAIL_MAILER`       | Mail driver (`smtp`, `ses`, `postmark`, `log`) | `log`                      |
| `MAIL_HOST`         | SMTP server hostname                           | `127.0.0.1`                |
| `MAIL_PORT`         | SMTP port (587 TLS, 465 SSL)                   | `2525`                     |
| `MAIL_USERNAME`     | SMTP username                                  | `null`                     |
| `MAIL_PASSWORD`     | SMTP password                                  | `null`                     |
| `MAIL_SCHEME`       | Encryption (`tls`, `ssl`)                      | `null`                     |
| `MAIL_FROM_ADDRESS` | Default sender email                           | `noreply@pulseboard.local` |
| `MAIL_FROM_NAME`    | Default sender name                            | `PulseBoard`               |

### WebSocket (Laravel Reverb)

| Variable            | Description                                            | Default             |
| ------------------- | ------------------------------------------------------ | ------------------- |
| `REVERB_APP_ID`     | Reverb application ID (**required**)                   | `pulseboard`        |
| `REVERB_APP_KEY`    | Reverb app key (random string for production)          | `pulseboard-key`    |
| `REVERB_APP_SECRET` | Reverb app secret (random string for production)       | `pulseboard-secret` |
| `REVERB_HOST`       | Public hostname clients connect to for WebSocket       | `localhost`         |
| `REVERB_PORT`       | Client-facing port (443 behind TLS proxy, 8080 direct) | `443`               |
| `REVERB_SCHEME`     | Protocol (`http` or `https`)                           | `https`             |

> **Important:** `REVERB_APP_ID` must be set — Reverb will silently exit every 60 seconds if it is null. `REVERB_HOST` should be the public hostname that browsers connect to (e.g. `ws.board.example.com`). When behind a TLS-terminating reverse proxy, set `REVERB_PORT=443` and `REVERB_SCHEME=https`. The internal Reverb server always listens on port 8080 regardless of these settings.

### Logging

| Variable      | Description                                             | Default  |
| ------------- | ------------------------------------------------------- | -------- |
| `LOG_CHANNEL` | Log channel                                             | `stack`  |
| `LOG_STACK`   | Stack channels (`single`, `daily`)                      | `single` |
| `LOG_LEVEL`   | Minimum log level (`debug`, `info`, `warning`, `error`) | `debug`  |

### Proxy / TLS

| Variable          | Description                                         | Default |
| ----------------- | --------------------------------------------------- | ------- |
| `TRUSTED_PROXIES` | Trusted proxy IPs (comma-separated, or `*` for all) |         |

### Docker Compose

| Variable               | Description                                    | Default                              |
| ---------------------- | ---------------------------------------------- | ------------------------------------ |
| `APP_PORT`             | Host port for web server (prod compose only)   | `8000`                               |
| `REVERB_EXTERNAL_PORT` | Host port for WebSocket (prod compose only)    | `9080`                               |
| `PULSEBOARD_IMAGE`     | Docker image reference (prod compose only)     | `ghcr.io/dowilcox/pulseboard:latest` |
| `DB_ROOT_PASSWORD`     | MySQL root password (required in prod compose) |                                      |

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

Tests run inside a dedicated Docker test container with an isolated environment (SQLite in-memory, array sessions, sync queue). The first run should build the test image, and the container will install Composer dependencies into a container-managed `vendor` volume. **Do not** run tests directly on the host or in the `app` container.

```bash
# First run or after Dockerfile/test-runner changes
docker compose --profile test build test

# Full test suite
docker compose --profile test run --rm test

# Specific test class
docker compose --profile test run --rm test --filter=TaskControllerTest

# Specific test file
docker compose --profile test run --rm test tests/Feature/Api/V1/ApiAuthTest.php

# Verbose output
docker compose --profile test run --rm test --verbose

# Frontend test run inside the same test container
docker compose --profile test run --rm test npm run test:run
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

### File Uploads

File uploads are managed by [spatie/laravel-medialibrary](https://spatie.be/docs/laravel-medialibrary). Uploaded files are stored as media collections on their parent models, with automatic image conversions for avatars.

| Upload Type               | Max Size | Disk              | Image Conversions                         |
| ------------------------- | -------- | ----------------- | ----------------------------------------- |
| Task attachments          | 15 MB    | `local` (private) | `thumb` (200x200) for images              |
| Editor images (rich text) | 5 MB     | `public`          | None                                      |
| Board avatars             | 2 MB     | `public`          | `avatar` (128x128), `avatar-lg` (256x256) |
| Team avatars              | 2 MB     | `public`          | `avatar` (128x128), `avatar-lg` (256x256) |

All image conversions run synchronously (non-queued) using the GD driver. Allowed attachment types: images, PDF, Office documents, text, CSV, ZIP, and video files.

Deleting a board or team cascades through Eloquent (not DB-level cascades) to ensure media files are cleaned up automatically.

### API

A REST API is available at `/api/v1/` authenticated via Sanctum personal access tokens. Endpoints cover teams, boards, tasks, and comments. Tokens can be created from the user profile or via the admin panel for bot users.

## Production Deployment

### Option 1: Docker (recommended)

The production compose file builds a self-contained image with all code and assets baked in.

**1. Configure environment:**

```bash
cp .env.example .env
```

Edit `.env` with production values — at minimum:

```ini
APP_ENV=production
APP_DEBUG=false
APP_URL=https://board.example.com
DB_PASSWORD=<strong-password>
DB_ROOT_PASSWORD=<strong-root-password>
REDIS_PASSWORD=<redis-password>
MAIL_MAILER=smtp
MAIL_HOST=smtp.example.com
MAIL_PORT=587
MAIL_SCHEME=tls
MAIL_USERNAME=<smtp-user>
MAIL_PASSWORD=<smtp-password>
MAIL_FROM_ADDRESS=noreply@example.com
REVERB_APP_ID=pulseboard
REVERB_APP_KEY=<random-32-char-string>
REVERB_APP_SECRET=<random-32-char-string>
REVERB_HOST=ws.board.example.com
REVERB_PORT=443
REVERB_SCHEME=https
SESSION_SECURE_COOKIE=true
OCTANE_HTTPS=true
LOG_LEVEL=info
LOG_STACK=daily
```

**2. Start the stack:**

```bash
docker compose -f docker-compose.prod.yml up -d
```

The entrypoint automatically generates `APP_KEY` (if missing), runs migrations, and caches configs.

**3. Create your first user:**

```bash
docker compose -f docker-compose.prod.yml exec app php artisan tinker
# > User::create(['name' => 'Admin', 'email' => 'admin@example.com', 'password' => Hash::make('...'), 'is_admin' => true]);
```

### Option 2: Manual Deployment

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

### Reverse Proxy

In production, place a reverse proxy (Nginx, Caddy, Traefik) in front of PulseBoard to handle TLS termination. The recommended setup uses a **dedicated subdomain** for WebSocket traffic:

- `board.example.com` → HTTP traffic to container port `8000`
- `ws.board.example.com` → WebSocket traffic to container port `8080`

Set `TRUSTED_PROXIES=*` (or the proxy IP) and `OCTANE_HTTPS=true` when behind a TLS-terminating proxy. Set `REVERB_HOST=ws.board.example.com` so the frontend connects to the correct WebSocket endpoint.

**Traefik example labels:**

```yaml
labels:
    - "traefik.enable=true"
    - "traefik.docker.network=proxy"
    # HTTP (Octane)
    - "traefik.http.routers.app.entrypoints=websecure"
    - "traefik.http.routers.app.rule=Host(`board.example.com`)"
    - "traefik.http.routers.app.tls=true"
    - "traefik.http.routers.app.tls.certresolver=letsencrypt"
    - "traefik.http.routers.app.service=app"
    - "traefik.http.services.app.loadbalancer.server.port=8000"
    # WebSocket (Reverb)
    - "traefik.http.routers.app-ws.entrypoints=websecure"
    - "traefik.http.routers.app-ws.rule=Host(`ws.board.example.com`)"
    - "traefik.http.routers.app-ws.tls=true"
    - "traefik.http.routers.app-ws.tls.certresolver=letsencrypt"
    - "traefik.http.routers.app-ws.service=app-ws"
    - "traefik.http.services.app-ws.loadbalancer.server.port=8080"
```

### Docker Services

| Service | Internal Port | Default Host Port | Description                                         |
| ------- | ------------- | ----------------- | --------------------------------------------------- |
| `app`   | 8000, 8080    | 8000, 9080        | FrankenPHP + Octane (web, queue, scheduler, Reverb) |
| `mysql` | 3306          | — (prod)          | MySQL 8.0 (not exposed to host in production)       |
| `redis` | 6379          | — (prod)          | Redis 7 (not exposed to host in production)         |

The app container uses Supervisor (`docker/supervisord.conf`) to manage Octane, the queue worker, the scheduler, and the Reverb server as a single unit.

## Building & Publishing Docker Images

Images are published to [GitHub Container Registry](https://ghcr.io/dowilcox/pulseboard) automatically when you push a version tag.

### Automated releases (recommended)

A GitHub Actions workflow builds and pushes the image on every version tag:

```bash
# Tag a release and push — CI handles the rest
git tag v1.0.0
git push origin v1.0.0
```

This produces image tags: `ghcr.io/dowilcox/pulseboard:1.0.0` and `ghcr.io/dowilcox/pulseboard:latest`.

### Manual build and push

```bash
# Build the production image
docker build -f docker/Dockerfile --target production -t ghcr.io/dowilcox/pulseboard:1.0.0 .

# Log in to GitHub Container Registry
echo $GITHUB_TOKEN | docker login ghcr.io -u USERNAME --password-stdin

# Push
docker push ghcr.io/dowilcox/pulseboard:1.0.0
```

### Release checklist

1. Ensure all tests pass: `docker compose --profile test run --rm test`
2. Run linting: `./vendor/bin/pint --test && npx tsc --noEmit`
3. Tag the release: `git tag v<version> && git push origin v<version>`
4. GitHub Actions builds, pushes the image, and creates a draft release
5. Edit the release notes on GitHub and publish

### Using a published image

Users can pull and run PulseBoard without building from source:

```bash
# Download the production compose file and env template
curl -o docker-compose.prod.yml https://raw.githubusercontent.com/dowilcox/pulseboard/main/docker-compose.prod.yml
curl -o .env https://raw.githubusercontent.com/dowilcox/pulseboard/main/.env.example

# Edit .env with production values (see Environment Variables section above)

# Start the stack
docker compose -f docker-compose.prod.yml up -d
```

## License

This project is licensed under the [GNU General Public License v3.0](LICENSE).
