# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

PulseBoard is a self-hosted Kanban project management app with GitLab and Figma integrations, real-time collaboration (Laravel Reverb WebSockets), SAML2 SSO, and a token-authenticated REST API.

**Stack:** Laravel 12 (Octane/FrankenPHP) + Inertia.js v2 + React 18 + TypeScript + MUI v6 (no Tailwind). MySQL 8.0, Redis 7.

## Commands

```bash
composer dev           # Start all dev services (Laravel serve + queue + logs + Vite HMR)
composer setup         # First-time setup (install deps, .env, key, migrate, build)
./vendor/bin/pint      # PHP code formatting (PSR-12)
npx tsc --noEmit       # TypeScript type checking
npx vite build         # Production frontend build
npm run test:run       # Frontend unit tests (Vitest, single run; `npm test` for watch mode)
docker compose up      # Containerized dev (app:8000, mysql:3306, redis:6379)
docker compose exec app php artisan db:seed --class=DemoSeeder   # Demo data (alice@demo.test / password)
```

## Container Build & Push

Registry: `ghcr.io/dowilcox/pulseboard`. Multi-stage Dockerfile (`docker/Dockerfile`): composer deps → frontend build → FrankenPHP production runtime. Production server is `linux/amd64` — always specify `--platform` when building on Apple Silicon.

```bash
# Build production container (must target linux/amd64 for deployment)
docker build --platform linux/amd64 -f docker/Dockerfile --target production -t ghcr.io/dowilcox/pulseboard:<version> -t ghcr.io/dowilcox/pulseboard:latest .

# Push to GitHub Container Registry
docker push ghcr.io/dowilcox/pulseboard:<version>
docker push ghcr.io/dowilcox/pulseboard:latest
```

## Architecture

### Backend: Actions Pattern

Business logic lives in Action classes (`app/Actions/{Teams,Boards,Tasks,Gitlab,Figma,Automation}/`), not controllers. Controllers are thin wrappers that validate, authorize, call an action, and return an Inertia response.

```php
// Action: single handle() method with AsAction trait
class CreateBoard {
    use AsAction;
    public function handle(Team $team, array $data): Board { ... }
}

// Controller: delegates to action
$board = CreateBoard::run($team, $request->validated());
return Inertia::render('Boards/Show', ['board' => $board]);
```

Cross-cutting services live in `app/Services/`: `ActivityLogger` (logs activity + dispatches `BoardChanged` broadcasts), `TaskAutomationDispatcher` (triggers automation rules), `TaskActivityNotifier`, `MentionParser`, `GitlabApiService`, `FigmaApiService`, `SamlService`. `app/Support/RichTextSanitizer` sanitizes all user-submitted rich text (task descriptions, comments) server-side.

### Routing

`routes/web.php` requires split route files from `routes/web/` (`profile`, `notifications`, `admin`, `templates`, `teams`, `team-fixed`, `board-scoped`). **Registration order matters:** team/board URLs are slug-based catch-alls (`/{team}/{board}/...`), so fixed-path routes must be registered before the slug includes — see comments in `web.php`.

Route names follow the nested RESTful pattern `teams.boards.columns.{action}` even though URLs use slugs. `Team` and `Board` route-bind by slug (Team also accepts UUID). Use `route('name', params)` (Ziggy) in both PHP and TypeScript; Ziggy routes are served via the `@routes` Blade directive, not a generated `ziggy.js`.

`routes/api.php` defines the v1 REST API (`/api/v1/...`) behind `auth:sanctum` — token CRUD is self-service, write endpoints require the `write` token ability — plus the GitLab webhook endpoint (`VerifyGitlabWebhook` middleware).

### Frontend: Inertia Page Resolution

No client-side router. Laravel routes render Inertia pages which resolve to React components:

- Route calls `Inertia::render('Boards/Show', $props)` -> loads `resources/js/Pages/Boards/Show.tsx`
- Pages receive typed props from Laravel, wrapped in a Layout component
- Shared data (auth user, teams list, unread notification count) injected via `HandleInertiaRequests` middleware

Rich text editing uses TipTap (`@tiptap/react`); drag-and-drop uses `@dnd-kit`; charts use `recharts`.

### Real-Time

Laravel Reverb (port 8080) + Laravel Echo. A single `BoardChanged` event broadcasts on `private-board.{boardId}`, dispatched from `ActivityLogger` and directly in delete/update actions. `broadcast(...)->toOthers()` prevents echo-back. `WebSocketContext` provides the `echo` instance and `connectionStatus`; board pages subscribe via `useBoardChannel`/`usePresence` hooks.

### Authorization

Three layers:

1. **`team.member` middleware** - rejects non-members at the route level
2. **Policies** (`TeamPolicy`, `BoardPolicy`) - fine-grained role checks (owner/admin/member)
3. **Controllers** call `$this->authorize()` before delegating to Actions

Team roles: `owner` > `admin` > `member`. Checked via `TeamMember` pivot table.

### Models

All models use UUID primary keys (`HasUuids` trait, `$incrementing = false`, `$keyType = 'string'`). All use `$guarded = []` since validation is handled by Form Requests.

Key relationships: Organization -> Teams -> Boards -> Columns (ordered by `sort_order`). Users belong to many Teams through `team_members` pivot.

### Frontend Styling

MUI v6 components exclusively - no Tailwind. Use `sx` prop for styling. Theme defined in `resources/js/theme/index.ts` (currently dark-only; `ThemeContext.tsx` is a static wrapper, no mode toggle).

**Important:** MUI Grid v6 must be imported from `@mui/material/Grid2` (not `Grid`). The `size` prop syntax: `<Grid size={{ xs: 12, sm: 6, md: 4 }}>`.

### Type Definitions

TypeScript interfaces for all backend models in `resources/js/types/index.d.ts`. `PageProps` type extends auth user + shared data. Path alias `@/*` maps to `resources/js/*`.

## Testing

### Backend (PHPUnit)

Tests **must** be run inside the Docker test container to ensure correct environment isolation (SQLite in-memory, array sessions, sync queue). Running tests directly in the `app` container or on the host will fail with 419 CSRF errors because `.env` values (e.g. `SESSION_DRIVER=redis`) override `phpunit.xml`.

```bash
# Run all tests
docker compose --profile test run --rm test

# Run a specific test class
docker compose --profile test run --rm test --filter=TeamBotControllerTest

# Run a specific test file
docker compose --profile test run --rm test tests/Feature/SomeTest.php
```

Config in `phpunit.xml`. Tests in `tests/Feature/` and `tests/Unit/`. Base class: `Tests\TestCase`.

### Frontend (Vitest)

Tests are colocated with source as `*.test.ts(x)` (mostly under `resources/js/utils/`). jsdom environment, setup file at `resources/js/test/setup.ts`, config in `vite.config.ts`.

```bash
npm run test:run                              # All frontend tests
npm run test:run -- richTextMarkdown          # Single test file by name filter
```

### Octane Caveat

The app runs under Octane (long-lived workers). **After changing routes, adding controllers, or editing PHP that the running app must pick up**, reload workers:

```bash
docker compose exec app php artisan octane:reload
```

## Database

MySQL 8.0. All tables use UUID PKs. Pivot tables cascade on delete; entity tables restrict. JSON columns for flexible data (`settings`, `email_notification_prefs`, `custom_fields`).

## Docs

SAML2 SSO setup guide: `docs/saml-configuration.md`. README covers environment variables and deployment.
