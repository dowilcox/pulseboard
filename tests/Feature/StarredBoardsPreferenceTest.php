<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class StarredBoardsPreferenceTest extends TestCase
{
    use RefreshDatabase;

    private User $user;

    protected function setUp(): void
    {
        parent::setUp();
        $this->user = User::factory()->create();
    }

    public function test_can_star_boards(): void
    {
        $boardA = Str::uuid()->toString();
        $boardB = Str::uuid()->toString();

        $response = $this->actingAs($this->user)->patch(
            route('profile.ui-preferences.update'),
            ['starred_boards' => [$boardA, $boardB]]
        );

        $response->assertRedirect();
        $response->assertSessionHasNoErrors();
        $this->user->refresh();
        $this->assertSame([$boardA, $boardB], $this->user->ui_preferences['starred_boards']);
    }

    public function test_starred_boards_replace_the_previous_list_and_dedupe(): void
    {
        $boardA = Str::uuid()->toString();
        $boardB = Str::uuid()->toString();

        $this->user->update([
            'ui_preferences' => ['starred_boards' => [$boardA]],
        ]);

        $this->actingAs($this->user)->patch(
            route('profile.ui-preferences.update'),
            ['starred_boards' => [$boardB, $boardB]]
        )->assertRedirect();

        $this->user->refresh();
        $this->assertSame([$boardB], $this->user->ui_preferences['starred_boards']);
    }

    public function test_starred_boards_can_be_cleared(): void
    {
        $this->user->update([
            'ui_preferences' => ['starred_boards' => [Str::uuid()->toString()]],
        ]);

        $this->actingAs($this->user)->patch(
            route('profile.ui-preferences.update'),
            ['starred_boards' => null]
        )->assertRedirect();

        $this->user->refresh();
        $this->assertSame([], $this->user->ui_preferences['starred_boards']);
    }

    public function test_unstarring_the_last_board_sends_an_empty_json_array(): void
    {
        $this->user->update([
            'ui_preferences' => ['starred_boards' => [Str::uuid()->toString()]],
        ]);

        // The Inertia client posts JSON, so an empty list arrives as [].
        $this->actingAs($this->user)->patchJson(
            route('profile.ui-preferences.update'),
            ['starred_boards' => []]
        )->assertRedirect();

        $this->user->refresh();
        $this->assertSame([], $this->user->ui_preferences['starred_boards']);
    }

    public function test_starring_preserves_other_preferences(): void
    {
        $teamBoard = Str::uuid()->toString();

        $this->user->update([
            'ui_preferences' => [
                'activity_sort_order' => 'desc',
                'board_order' => ['team-1' => [$teamBoard]],
            ],
        ]);

        $this->actingAs($this->user)->patch(
            route('profile.ui-preferences.update'),
            ['starred_boards' => [$teamBoard]]
        )->assertRedirect();

        $this->user->refresh();
        $this->assertSame('desc', $this->user->ui_preferences['activity_sort_order']);
        $this->assertSame([$teamBoard], $this->user->ui_preferences['board_order']['team-1']);
        $this->assertSame([$teamBoard], $this->user->ui_preferences['starred_boards']);
    }

    public function test_starred_boards_must_be_uuids(): void
    {
        $this->actingAs($this->user)->patch(
            route('profile.ui-preferences.update'),
            ['starred_boards' => ['not-a-uuid']]
        )->assertSessionHasErrors('starred_boards.0');

        $this->user->refresh();
        $this->assertArrayNotHasKey('starred_boards', $this->user->ui_preferences ?? []);
    }

    public function test_starred_boards_must_be_an_array(): void
    {
        $this->actingAs($this->user)->patch(
            route('profile.ui-preferences.update'),
            ['starred_boards' => 'abc']
        )->assertSessionHasErrors('starred_boards');
    }

    public function test_starred_boards_are_capped_at_one_hundred(): void
    {
        $ids = collect(range(1, 101))->map(fn () => Str::uuid()->toString())->all();

        $this->actingAs($this->user)->patch(
            route('profile.ui-preferences.update'),
            ['starred_boards' => $ids]
        )->assertSessionHasErrors('starred_boards');
    }
}
