<?php

namespace App\Support;

use App\Models\Board;
use App\Models\Team;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

/**
 * Generates URL-safe slugs that are unique within a scope and never collide
 * with fixed application routes.
 *
 * Teams are routed via the catch-all /{team} and boards via /{team}/{board}
 * (see routes/web.php and routes/web/*.php), so a slug equal to a fixed path
 * segment would either be shadowed by the fixed route or, for unshadowed HTTP
 * verbs, hijack it (e.g. PUT /admin resolving as teams.update).
 */
class UniqueSlug
{
    /**
     * First URL path segments of every fixed web route. A team slug must not
     * equal any of these.
     *
     * Derived from routes/web.php, routes/auth.php and routes/web/*.php:
     * collect the first path segment of each route that is not "{team}".
     * Framework-registered endpoints (health, api prefix, broadcasting auth,
     * storage symlink, sanctum) are reserved as well.
     *
     * @var list<string>
     */
    public const RESERVED_TEAM_SLUGS = [
        // routes/web.php
        'avatars', 'auth', 'dashboard',
        // routes/auth.php
        'register', 'login', 'forgot-password', 'reset-password',
        'verify-email', 'email', 'confirm-password', 'password', 'logout',
        // routes/web/profile.php
        'profile',
        // routes/web/notifications.php
        'notifications',
        // routes/web/admin.php
        'admin',
        // routes/web/templates.php
        'templates',
        // routes/web/teams.php
        'teams',
        // framework endpoints
        'up', 'api', 'broadcasting', 'storage', 'sanctum',
    ];

    /**
     * Second URL path segments under /{team}/ of every fixed web route. A
     * board slug must not equal any of these.
     *
     * Derived from routes/web/team-fixed.php: collect the second path segment
     * of each /{team}/... route that is not "{board}".
     *
     * @var list<string>
     */
    public const RESERVED_BOARD_SLUGS = [
        'settings', 'image', 'members', 'boards', 'task-templates',
        'dashboard', 'export', 'bots', 'figma', 'gitlab', 'labels',
        'templates',
    ];

    /**
     * Generate a slug from $name that is not reserved and not already taken
     * by another row matched by $query (optionally excluding one id).
     *
     * @param  Builder<Model>  $query
     * @param  list<string>  $reserved
     */
    public static function generate(
        Builder $query,
        string $name,
        array $reserved = [],
        ?string $excludeId = null,
    ): string {
        $base = Str::slug($name);

        if ($base === '') {
            $base = 'untitled';
        }

        $slug = $base;
        $counter = 1;

        while (
            in_array($slug, $reserved, true)
            || (clone $query)
                ->where('slug', $slug)
                ->when(
                    $excludeId !== null,
                    fn (Builder $q) => $q->where('id', '!=', $excludeId),
                )
                ->exists()
        ) {
            $slug = "{$base}-{$counter}";
            $counter++;
        }

        return $slug;
    }

    /**
     * Generate a slug for a team, unique across all teams.
     */
    public static function forTeam(string $name, ?string $excludeId = null): string
    {
        return self::generate(
            Team::query(),
            $name,
            self::RESERVED_TEAM_SLUGS,
            $excludeId,
        );
    }

    /**
     * Generate a slug for a board, unique within the given team.
     */
    public static function forBoard(
        Team|string $team,
        string $name,
        ?string $excludeId = null,
    ): string {
        $teamId = $team instanceof Team ? $team->id : $team;

        return self::generate(
            Board::query()->where('team_id', $teamId),
            $name,
            self::RESERVED_BOARD_SLUGS,
            $excludeId,
        );
    }
}
