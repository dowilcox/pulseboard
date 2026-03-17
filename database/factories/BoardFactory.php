<?php

namespace Database\Factories;

use App\Models\Board;
use App\Models\Team;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<Board>
 */
class BoardFactory extends Factory
{
    public function definition(): array
    {
        $name = fake()->words(3, true);

        return [
            'team_id' => Team::factory(),
            'name' => $name,
            'slug' => Str::slug($name).'-'.fake()->unique()->numberBetween(1, 9999),
            'description' => fake()->optional(0.5)->sentence(),
            'sort_order' => fake()->numberBetween(0, 10),
            'is_archived' => false,
        ];
    }
}
