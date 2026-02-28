<?php

namespace Database\Factories;

use App\Models\Board;
use App\Models\Column;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\Task>
 */
class TaskFactory extends Factory
{
    public function definition(): array
    {
        return [
            'board_id' => Board::factory(),
            'column_id' => Column::factory(),
            'title' => fake()->sentence(4),
            'description' => fake()->optional(0.7)->paragraph(),
            'priority' => fake()->randomElement(['urgent', 'high', 'medium', 'low', 'none']),
            'sort_order' => fake()->randomFloat(2, 0, 100),
            'due_date' => fake()->optional(0.5)->dateTimeBetween('now', '+30 days'),
            'effort_estimate' => fake()->optional(0.3)->numberBetween(1, 40),
            'custom_fields' => null,
            'created_by' => User::factory(),
        ];
    }
}
