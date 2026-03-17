<?php

namespace App\Actions\Boards;

use App\Models\Board;
use Illuminate\Support\Str;
use Lorisleiva\Actions\Concerns\AsAction;

class UpdateBoard
{
    use AsAction;

    /**
     * Update the given board's name, description, and optionally slug.
     *
     * @param  array{name?: string, description?: string|null, slug?: string}  $data
     */
    public function handle(Board $board, array $data): Board
    {
        if (isset($data['slug'])) {
            $data['slug'] = Str::slug($data['slug']);
        } elseif (isset($data['name'])) {
            $data['slug'] = $this->generateUniqueSlug($board, $data['name']);
        }

        $board->update($data);

        return $board->refresh();
    }

    private function generateUniqueSlug(Board $board, string $name): string
    {
        $slug = Str::slug($name);
        $originalSlug = $slug;
        $counter = 1;

        while (
            Board::where('team_id', $board->team_id)
                ->where('slug', $slug)
                ->where('id', '!=', $board->id)
                ->exists()
        ) {
            $slug = "{$originalSlug}-{$counter}";
            $counter++;
        }

        return $slug;
    }
}
