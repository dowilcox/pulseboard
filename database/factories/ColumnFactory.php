<?php

namespace Database\Factories;

use App\Models\Board;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\Column>
 */
class ColumnFactory extends Factory
{
    public function definition(): array
    {
        return [
            'board_id' => Board::factory(),
            'name' => fake()->randomElement(['To Do', 'In Progress', 'In Review', 'Done']),
            'color' => fake()->hexColor(),
            'sort_order' => fake()->numberBetween(0, 10),
            'wip_limit' => null,
            'is_done_column' => false,
        ];
    }
}
