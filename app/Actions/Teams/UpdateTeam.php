<?php

namespace App\Actions\Teams;

use App\Models\Team;
use Illuminate\Support\Str;
use Lorisleiva\Actions\Concerns\AsAction;

class UpdateTeam
{
    use AsAction;

    /**
     * Update the given team with the provided data.
     *
     * @param  array{name?: string, description?: string|null, settings?: array<string, mixed>}  $data
     */
    public function handle(Team $team, array $data): Team
    {
        $attributes = [];

        if (isset($data['name'])) {
            $attributes['name'] = $data['name'];
            $attributes['slug'] = $this->generateUniqueSlug($data['name'], $team->id);
        }

        if (array_key_exists('description', $data)) {
            $attributes['description'] = $data['description'];
        }

        if (isset($data['settings'])) {
            $attributes['settings'] = array_merge($team->settings ?? [], $data['settings']);
        }

        $team->update($attributes);

        return $team->fresh();
    }

    /**
     * Generate a unique slug, excluding the current team from the uniqueness check.
     */
    private function generateUniqueSlug(string $name, string $excludeTeamId): string
    {
        $slug = Str::slug($name);
        $originalSlug = $slug;
        $counter = 1;

        while (Team::where('slug', $slug)->where('id', '!=', $excludeTeamId)->exists()) {
            $slug = "{$originalSlug}-{$counter}";
            $counter++;
        }

        return $slug;
    }
}
