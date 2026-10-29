<?php

namespace Database\Factories;

use App\Models\Board;
use App\Models\BoardCustomField;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<BoardCustomField>
 */
class BoardCustomFieldFactory extends Factory
{
    public function definition(): array
    {
        return [
            'board_id' => Board::factory(),
            'name' => fake()->unique()->words(2, true),
            'type' => BoardCustomField::TYPE_TEXT,
            'options' => null,
            'sort_order' => 0,
            'show_on_card' => false,
        ];
    }

    public function ofType(string $type): static
    {
        return $this->state(fn () => ['type' => $type]);
    }

    /**
     * A select / multi_select field with the given option labels. Option ids
     * are "opt-<n>" so tests can reference them.
     *
     * @param  array<int, string>  $labels
     */
    public function withOptions(string $type = BoardCustomField::TYPE_SELECT, array $labels = ['Low', 'Medium', 'High']): static
    {
        return $this->state(fn () => [
            'type' => $type,
            'options' => array_map(
                fn ($label, $index) => [
                    'id' => 'opt-'.($index + 1),
                    'label' => $label,
                    'color' => '#6366f1',
                ],
                $labels,
                array_keys($labels),
            ),
        ]);
    }
}
