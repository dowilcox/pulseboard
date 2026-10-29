<?php

namespace App\Mcp\Tools\Concerns;

use App\Mcp\Exceptions\ToolException;
use App\Models\Board;
use App\Models\Column;
use App\Models\Label;
use App\Models\Task;
use App\Models\Team;
use App\Models\TeamMember;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Str;

/**
 * Resolves the friendly identifiers agents pass (UUIDs, slugs, task
 * numbers, names, "me") into models, always scoped to the teams the
 * authenticated user belongs to. Anything outside those teams is reported
 * as "not found" so the existence of other teams' data is never revealed.
 */
trait ResolvesModels
{
    /**
     * Subquery of team ids the user is a member of.
     */
    protected function memberTeamIds(User $user): Builder
    {
        return TeamMember::query()->where('user_id', $user->id)->select('team_id');
    }

    /**
     * Subquery of board ids on the user's teams.
     */
    protected function memberBoardIds(User $user, bool $activeOnly = false): Builder
    {
        return Board::query()
            ->whereIn('team_id', $this->memberTeamIds($user))
            ->when($activeOnly, fn ($q) => $q->active())
            ->select('id');
    }

    protected function resolveTeam(User $user, mixed $ref): Team
    {
        $ref = trim((string) $ref);

        if ($ref === '') {
            throw new ToolException('A team is required (UUID or slug). Use list_teams to see your teams.');
        }

        $team = Team::query()
            ->whereIn('id', $this->memberTeamIds($user))
            ->where(Str::isUuid($ref) ? 'id' : 'slug', $ref)
            ->first();

        if (! $team || Gate::forUser($user)->denies('view', $team)) {
            throw new ToolException("Team \"{$ref}\" was not found among your teams. Use list_teams to see available teams.");
        }

        return $team;
    }

    /**
     * Resolve a board by UUID, slug (unique within a team), or
     * "team-slug/board-slug".
     */
    protected function resolveBoard(User $user, mixed $ref, mixed $teamRef = null): Board
    {
        $ref = trim((string) $ref);
        $teamRef = trim((string) $teamRef);

        if ($ref === '') {
            throw new ToolException('A board is required (UUID, slug, or "team-slug/board-slug"). Use list_boards to see boards.');
        }

        if (! Str::isUuid($ref) && str_contains($ref, '/')) {
            [$teamRef, $ref] = array_map('trim', explode('/', $ref, 2));
        }

        if (Str::isUuid($ref)) {
            $board = Board::query()->whereIn('team_id', $this->memberTeamIds($user))->find($ref);
        } elseif ($teamRef !== '') {
            $board = $this->resolveTeam($user, $teamRef)->boards()->where('slug', $ref)->first();
        } else {
            $candidates = Board::query()
                ->whereIn('team_id', $this->memberTeamIds($user))
                ->where('slug', $ref)
                ->with('team:id,slug')
                ->limit(10)
                ->get();

            if ($candidates->count() > 1) {
                $teams = $candidates->map(fn (Board $b) => $b->team->slug)->implode(', ');

                throw new ToolException("Board slug \"{$ref}\" exists in several of your teams ({$teams}). Pass `team` as well, or use \"team-slug/{$ref}\" or the board UUID.");
            }

            $board = $candidates->first();
        }

        if (! $board || Gate::forUser($user)->denies('view', $board)) {
            throw new ToolException("Board \"{$ref}\" was not found among your teams' boards. Use list_boards to see available boards.");
        }

        return $board->loadMissing('team');
    }

    /**
     * Resolve a task by UUID, or by board-scoped task number ("12", "#12",
     * "12-some-slug") together with a board. "board-slug#12" and
     * "team-slug/board-slug#12" are accepted on their own.
     */
    protected function resolveTask(User $user, mixed $ref, mixed $boardRef = null, mixed $teamRef = null): Task
    {
        $ref = trim((string) $ref);
        $boardRef = trim((string) $boardRef);

        if ($ref === '') {
            throw new ToolException('A task is required: its UUID, or its number together with `board`.');
        }

        if (Str::isUuid($ref)) {
            $task = Task::query()->whereIn('board_id', $this->memberBoardIds($user))->find($ref);
        } else {
            if (preg_match('/^(.+?)#(\d+)$/', $ref, $m)) {
                $boardRef = $boardRef !== '' ? $boardRef : $m[1];
                $ref = $m[2];
            }

            if (! preg_match('/^#?(\d{1,10})(?:-.*)?$/', $ref, $m) || (int) $m[1] <= 0) {
                throw new ToolException("Task \"{$ref}\" is not a valid task UUID or task number.");
            }

            if ($boardRef === '') {
                throw new ToolException("Task number \"{$ref}\" is board-scoped: pass `board` (and `team` if the slug is ambiguous), use \"board-slug#{$m[1]}\", or use the task UUID.");
            }

            $board = $this->resolveBoard($user, $boardRef, $teamRef);

            $task = Task::query()
                ->where('board_id', $board->id)
                ->where('task_number', (int) $m[1])
                ->first();
        }

        if (! $task || Gate::forUser($user)->denies('view', $task)) {
            throw new ToolException("Task \"{$ref}\" was not found. Use list_tasks or search_tasks to find tasks.");
        }

        return $task->loadMissing('board.team');
    }

    /**
     * Resolve a column of the board by UUID or (case-insensitive) name.
     * Null/empty returns the board's first column.
     */
    protected function resolveColumn(Board $board, mixed $ref): Column
    {
        $ref = trim((string) $ref);
        $columns = $board->columns()->get();

        if ($columns->isEmpty()) {
            throw new ToolException("Board \"{$board->slug}\" has no columns.");
        }

        if ($ref === '') {
            return $columns->first();
        }

        $column = Str::isUuid($ref)
            ? $columns->firstWhere('id', $ref)
            : $columns->first(fn (Column $c) => mb_strtolower($c->name) === mb_strtolower($ref));

        if (! $column) {
            throw new ToolException("Column \"{$ref}\" was not found on board \"{$board->slug}\". Available columns: "
                .$columns->pluck('name')->map(fn ($n) => "\"{$n}\"")->implode(', ').'.');
        }

        return $column;
    }

    /**
     * Resolve "me", user UUIDs or emails to ids of active members of the team.
     *
     * @return list<string>
     */
    protected function resolveMemberIds(User $user, Team $team, array $refs): array
    {
        $ids = [];
        $unknown = [];

        $members = $team->members()->whereNull('deactivated_at')->get(['users.id', 'users.email']);

        foreach ($refs as $ref) {
            $ref = trim((string) $ref);

            if ($ref === '') {
                continue;
            }

            $member = match (true) {
                mb_strtolower($ref) === 'me' => $members->firstWhere('id', $user->id),
                Str::isUuid($ref) => $members->firstWhere('id', $ref),
                default => $members->first(fn (User $m) => mb_strtolower($m->email) === mb_strtolower($ref)),
            };

            $member ? $ids[] = $member->id : $unknown[] = $ref;
        }

        if ($unknown !== []) {
            throw new ToolException('Not active members of team "'.$team->slug.'": '.implode(', ', $unknown)
                .'. Use get_board to list members (pass user ids, emails, or "me").');
        }

        return array_values(array_unique($ids));
    }

    /**
     * Resolve label UUIDs or (case-insensitive) names to ids of team labels.
     *
     * @return list<string>
     */
    protected function resolveLabelIds(Team $team, array $refs): array
    {
        $labels = Label::query()->where('team_id', $team->id)->get(['id', 'name']);
        $ids = [];
        $unknown = [];

        foreach ($refs as $ref) {
            $ref = trim((string) $ref);

            if ($ref === '') {
                continue;
            }

            $label = Str::isUuid($ref)
                ? $labels->firstWhere('id', $ref)
                : $labels->first(fn (Label $l) => mb_strtolower($l->name) === mb_strtolower($ref));

            $label ? $ids[] = $label->id : $unknown[] = $ref;
        }

        if ($unknown !== []) {
            $available = $labels->pluck('name')->map(fn ($n) => "\"{$n}\"")->implode(', ') ?: 'none';

            throw new ToolException('Unknown labels: '.implode(', ', $unknown).". Labels on team \"{$team->slug}\": {$available}. (Creating labels is not available over MCP.)");
        }

        return array_values(array_unique($ids));
    }
}
