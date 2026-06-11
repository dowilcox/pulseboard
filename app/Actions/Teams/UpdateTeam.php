<?php

namespace App\Actions\Teams;

use App\Models\Team;
use App\Support\UniqueSlug;
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

        if (isset($data['slug'])) {
            $attributes['slug'] = UniqueSlug::forTeam($data['slug'], $team->id);
        } elseif (isset($data['name'])) {
            $attributes['slug'] = UniqueSlug::forTeam($data['name'], $team->id);
        }

        if (isset($data['name'])) {
            $attributes['name'] = $data['name'];
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
}
