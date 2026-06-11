<?php

namespace App\Actions\Boards;

use App\Models\Board;
use App\Models\Team;
use App\Support\UniqueSlug;
use Lorisleiva\Actions\Concerns\AsAction;

class CreateBoard
{
    use AsAction;

    /**
     * The default columns to create for a new board.
     *
     * @var array<int, array{name: string, color: string, is_done_column: bool}>
     */
    private const DEFAULT_COLUMNS = [
        ['name' => 'To Do', 'color' => '#6366f1', 'is_done_column' => false],
        ['name' => 'In Progress', 'color' => '#f59e0b', 'is_done_column' => false],
        ['name' => 'In Review', 'color' => '#3b82f6', 'is_done_column' => false],
        ['name' => 'Done', 'color' => '#22c55e', 'is_done_column' => true],
    ];

    /**
     * Create a new board for the given team.
     *
     * Pass $columns to create those instead of the default columns.
     *
     * @param  array{name: string, description?: string|null}  $data
     * @param  array<int, array{name: string, color: string, wip_limit?: int|null, is_done_column?: bool}>|null  $columns
     */
    public function handle(Team $team, array $data, ?array $columns = null): Board
    {
        $nextSortOrder = $team->boards()->max('sort_order') + 1;

        $board = $team->boards()->create([
            'name' => $data['name'],
            'slug' => UniqueSlug::forBoard($team, $data['name']),
            'description' => $data['description'] ?? null,
            'sort_order' => $nextSortOrder,
        ]);

        foreach ($columns ?? self::DEFAULT_COLUMNS as $index => $column) {
            $board->columns()->create([
                'name' => $column['name'],
                'color' => $column['color'],
                'wip_limit' => $column['wip_limit'] ?? null,
                'is_done_column' => $column['is_done_column'] ?? false,
                'sort_order' => $index,
            ]);
        }

        return $board->load('columns');
    }
}
