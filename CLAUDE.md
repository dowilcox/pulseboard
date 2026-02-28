# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

PulseBoard is a self-hosted Kanban project management app with GitLab integration. The full implementation plan is at `PulseBoard-Implementation-Plan.md`.

**Stack:** Laravel 12 + Inertia.js v2 + React 18 + TypeScript + MUI v6 (no Tailwind)

## Commands

```bash
composer dev           # Start all dev services (Laravel serve + queue + logs + Vite HMR)
composer setup         # First-time setup (install deps, .env, key, migrate, build)
composer test          # Run all tests
php artisan test --filter=ClassName           # Single test class
php artisan test tests/Feature/SomeTest.php   # Single test file
./vendor/bin/pint      # PHP code formatting (PSR-12)
npx tsc --noEmit       # TypeScript type checking
npx vite build         # Production frontend build
docker-compose up      # Containerized dev (app:8000, mysql:3306, redis:6379)
```

## Architecture

### Backend: Actions Pattern

Business logic lives in Action classes (`app/Actions/`), not controllers. Controllers are thin wrappers that validate, authorize, call an action, and return an Inertia response.

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

### Frontend: Inertia Page Resolution

No client-side router. Laravel routes render Inertia pages which resolve to React components:
- Route calls `Inertia::render('Boards/Show', $props)` -> loads `resources/js/Pages/Boards/Show.tsx`
- Pages receive typed props from Laravel, wrapped in a Layout component
- Shared data (auth user, teams list) injected via `HandleInertiaRequests` middleware

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

MUI v6 components exclusively - no Tailwind. Use `sx` prop for styling. Theme defined in `resources/js/theme/index.ts` with light/dark variants. Theme switching via `ThemeContext`.

**Important:** MUI Grid v6 must be imported from `@mui/material/Grid2` (not `Grid`). The `size` prop syntax: `<Grid size={{ xs: 12, sm: 6, md: 4 }}>`.

### Route Naming

Nested RESTful pattern: `teams.boards.columns.{action}`. Routes defined in `routes/web.php`. Use `route('name', params)` (Ziggy) in both PHP and TypeScript.

### Type Definitions

TypeScript interfaces for all backend models in `resources/js/types/index.d.ts`. `PageProps` type extends auth user + shared data. Path alias `@/*` maps to `resources/js/*`.

## Testing

PHPUnit with SQLite in-memory database. Config in `phpunit.xml`. Tests in `tests/Feature/` and `tests/Unit/`. Base class: `Tests\TestCase`.

## Database

MySQL 8.0. All tables use UUID PKs. Pivot tables cascade on delete; entity tables restrict. JSON columns for flexible data (`settings`, `email_notification_prefs`, `custom_fields`).
