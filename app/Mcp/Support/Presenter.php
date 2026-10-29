<?php

namespace App\Mcp\Support;

use App\Models\Activity;
use App\Models\Board;
use App\Models\BoardCustomField;
use App\Models\Column;
use App\Models\Comment;
use App\Models\Label;
use App\Models\Task;
use App\Models\Team;
use App\Models\User;
use Carbon\CarbonInterface;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;

/**
 * Shapes models into compact arrays for MCP tool output. Null values are
 * dropped to keep payloads small; every task carries its id, board-scoped
 * number, a human "ref" (board-slug#number) and a web URL.
 *
 * Callers are responsible for eager-loading the relations used here
 * (Presenter::TASK_SUMMARY_RELATIONS for task summaries).
 */
class Presenter
{
    public const TASK_SUMMARY_RELATIONS = [
        'board:id,team_id,name,slug',
        'board.team:id,name,slug',
        'board.customFields',
        'column:id,board_id,name,is_done_column',
        'assignees:id,name',
        'labels:id,name,color',
        'blockedBy:id,completed_at',
    ];

    public static function team(Team $team, ?string $role = null): array
    {
        return self::compact([
            'id' => $team->id,
            'slug' => $team->slug,
            'name' => $team->name,
            'description' => $team->description,
            'role' => $role,
        ]);
    }

    public static function board(Board $board, ?Team $team = null): array
    {
        $team ??= $board->team;

        return self::compact([
            'id' => $board->id,
            'slug' => $board->slug,
            'name' => $board->name,
            'team' => $team?->slug,
            'description' => $board->description,
            'archived' => $board->is_archived ?: null,
            'url' => $team ? route('teams.boards.show', [$team->slug, $board->slug]) : null,
        ]);
    }

    public static function column(Column $column): array
    {
        return self::compact([
            'id' => $column->id,
            'name' => $column->name,
            'position' => $column->sort_order,
            'wip_limit' => $column->wip_limit,
            'is_done_column' => (bool) $column->is_done_column,
        ]);
    }

    public static function label(Label $label): array
    {
        return ['id' => $label->id, 'name' => $label->name, 'color' => $label->color];
    }

    public static function user(?User $user): ?array
    {
        if (! $user) {
            return null;
        }

        return ['id' => $user->id, 'name' => $user->name];
    }

    public static function taskRef(Task $task): string
    {
        $boardSlug = $task->relationLoaded('board') ? $task->board?->slug : null;

        return ($boardSlug ?? 'board').'#'.$task->task_number;
    }

    public static function taskUrl(Task $task): ?string
    {
        $board = $task->board;
        $team = $board?->team;

        if (! $board || ! $team) {
            return null;
        }

        return route('tasks.show', [$team->slug, $board->slug, $task->slug ?? $task->id]);
    }

    /**
     * Compact task representation for lists.
     */
    public static function taskSummary(Task $task): array
    {
        $openBlockers = $task->relationLoaded('blockedBy')
            ? $task->blockedBy->whereNull('completed_at')->count()
            : null;

        return self::compact([
            'id' => $task->id,
            'number' => $task->task_number,
            'ref' => self::taskRef($task),
            'title' => $task->title,
            'team' => $task->board?->team?->slug,
            'board' => $task->board?->slug,
            'column' => $task->relationLoaded('column') && $task->column ? [
                'id' => $task->column->id,
                'name' => $task->column->name,
            ] : null,
            'priority' => $task->priority !== 'none' ? $task->priority : null,
            'due_date' => self::date($task->due_date),
            'completed' => $task->completed_at !== null,
            'completed_at' => self::timestamp($task->completed_at),
            'assignees' => $task->relationLoaded('assignees')
                ? $task->assignees->map(fn (User $u) => self::user($u))->values()->all()
                : null,
            'labels' => $task->relationLoaded('labels')
                ? $task->labels->pluck('name')->values()->all()
                : null,
            'parent_task_id' => $task->parent_task_id,
            'subtasks' => isset($task->subtasks_count) && $task->subtasks_count > 0 ? [
                'total' => (int) $task->subtasks_count,
                'completed' => (int) ($task->completed_subtasks_count ?? 0),
            ] : null,
            'checklist' => $task->checklist_progress,
            'custom_fields' => $task->board?->relationLoaded('customFields')
                ? CustomFields::present($task->board->customFields, $task->custom_fields)
                : null,
            'comments' => isset($task->comments_count) && $task->comments_count > 0 ? (int) $task->comments_count : null,
            'blocked_by_open_tasks' => $openBlockers ?: null,
            'updated_at' => self::timestamp($task->updated_at),
            'url' => self::taskUrl($task),
        ]);
    }

    /**
     * Minimal reference to a related task (parent, subtask, dependency).
     */
    public static function relatedTask(Task $task): array
    {
        return self::compact([
            'id' => $task->id,
            'number' => $task->task_number,
            'ref' => self::taskRef($task),
            'title' => $task->title,
            'completed' => $task->completed_at !== null,
            'column' => $task->relationLoaded('column') ? $task->column?->name : null,
            'url' => $task->relationLoaded('board') ? self::taskUrl($task) : null,
        ]);
    }

    public static function comment(Comment $comment, bool $withReplies = true): array
    {
        return self::compact([
            'id' => $comment->id,
            'author' => self::user($comment->user),
            'body' => RichText::toMarkdown($comment->body),
            'created_at' => self::timestamp($comment->created_at),
            'edited' => $comment->updated_at && $comment->created_at
                && $comment->updated_at->gt($comment->created_at) ? true : null,
            'replies' => $withReplies && $comment->relationLoaded('replies') && $comment->replies->isNotEmpty()
                ? $comment->replies->sortBy('created_at')->map(fn (Comment $reply) => self::comment($reply, false))->values()->all()
                : null,
        ]);
    }

    /**
     * @param  Collection<int, BoardCustomField>|null  $customFields  Board fields, to name custom field changes.
     */
    public static function activity(Activity $activity, array $extra = [], ?Collection $customFields = null): array
    {
        $task = $activity->task;
        $changes = $activity->changes ?? [];

        if ($customFields && is_array($changes['custom_fields'] ?? null)) {
            $changes['custom_fields'] = CustomFields::presentChange($customFields, $changes['custom_fields']);
        }

        return self::compact([
            'at' => self::timestamp($activity->created_at),
            'actor' => $activity->user?->name ?? 'System',
            'action' => $activity->action,
            'task' => $task ? self::compact([
                'id' => $task->id,
                'ref' => self::taskRef($task),
                'title' => $task->title,
            ]) : null,
            'details' => self::activityDetails($changes),
            ...$extra,
        ]);
    }

    /**
     * Activity change payloads can contain whole descriptions; summarise
     * long values and drop internal ids so the output stays readable.
     */
    private static function activityDetails(array $changes): ?array
    {
        if ($changes === []) {
            return null;
        }

        $details = [];

        foreach ($changes as $key => $value) {
            if (is_string($key) && (str_ends_with($key, '_id') || str_ends_with($key, '_ids'))) {
                continue;
            }

            if ($key === 'description') {
                $details['description'] = 'updated';

                continue;
            }

            $details[$key] = self::shorten($value);
        }

        return $details === [] ? null : $details;
    }

    private static function shorten(mixed $value): mixed
    {
        if (is_string($value)) {
            return Str::limit(RichText::preview($value, 200) ?? '', 200);
        }

        if (is_array($value)) {
            return array_map(fn ($v) => self::shorten($v), $value);
        }

        return $value;
    }

    public static function date(?CarbonInterface $date): ?string
    {
        return $date?->toDateString();
    }

    public static function timestamp(?CarbonInterface $date): ?string
    {
        return $date?->toIso8601String();
    }

    /**
     * Drop null values (but keep false/0/empty arrays).
     */
    public static function compact(array $data): array
    {
        return array_filter($data, fn ($value) => $value !== null);
    }
}
