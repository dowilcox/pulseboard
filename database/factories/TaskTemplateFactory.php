<?php

namespace Database\Factories;

use App\Models\Team;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\TaskTemplate>
 */
class TaskTemplateFactory extends Factory
{
    public function definition(): array
    {
        return [
            'team_id' => Team::factory(),
            'name' => fake()->sentence(3),
            'description_template' => fake()->optional(0.7)->paragraph(),
            'priority' => fake()->randomElement(['urgent', 'high', 'medium', 'low', 'none']),
            'effort_estimate' => fake()->optional(0.3)->numberBetween(1, 20),
            'checklists' => null,
            'label_ids' => null,
            'created_by' => User::factory(),
        ];
    }
}
