<?php

namespace App\Actions\Teams;

use App\Models\Team;
use App\Models\User;
use App\Support\UniqueSlug;
use Lorisleiva\Actions\Concerns\AsAction;

class CreateTeam
{
    use AsAction;

    /**
     * Create a new team and add the creator as the owner.
     *
     * @param  array{name: string, description?: string|null}  $data
     */
    public function handle(User $user, array $data): Team
    {
        $team = Team::create([
            'name' => $data['name'],
            'slug' => UniqueSlug::forTeam($data['name']),
            'description' => $data['description'] ?? null,
            'settings' => [],
        ]);

        $team->members()->attach($user->id, ['role' => 'owner']);

        return $team->load('members');
    }
}
