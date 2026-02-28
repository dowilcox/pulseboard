<?php

namespace App\Actions\Boards;

use App\Models\Board;
use App\Models\Team;
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
     * Create a new board for the given team with default columns.
     *
     * @param  array{name: string, description?: string|null}  $data
     */
    public function handle(Team $team, array $data): Board
    {
        $nextSortOrder = $team->boards()->max('sort_order') + 1;

        $board = $team->boards()->create([
            'name' => $data['name'],
            'description' => $data['description'] ?? null,
            'sort_order' => $nextSortOrder,
        ]);

        foreach (self::DEFAULT_COLUMNS as $index => $column) {
            $board->columns()->create([
                'name' => $column['name'],
                'color' => $column['color'],
                'is_done_column' => $column['is_done_column'],
                'sort_order' => $index,
            ]);
        }

        return $board->load('columns');
    }
}
