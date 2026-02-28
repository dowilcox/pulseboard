<?php

namespace App\Actions\Teams;

use App\Models\Team;
use App\Models\User;
use Illuminate\Support\Str;
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
            'slug' => $this->generateUniqueSlug($data['name']),
            'description' => $data['description'] ?? null,
            'settings' => [],
        ]);

        $team->members()->attach($user->id, ['role' => 'owner']);

        return $team->load('members');
    }

    /**
     * Generate a unique slug from the given name.
     */
    private function generateUniqueSlug(string $name): string
    {
        $slug = Str::slug($name);
        $originalSlug = $slug;
        $counter = 1;

        while (Team::where('slug', $slug)->exists()) {
            $slug = "{$originalSlug}-{$counter}";
            $counter++;
        }

        return $slug;
    }
}
