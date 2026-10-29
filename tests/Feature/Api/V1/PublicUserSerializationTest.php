<?php

namespace Tests\Feature\Api\V1;

use App\Models\Board;
use App\Models\Column;
use App\Models\Comment;
use App\Models\Task;
use App\Models\TaskTemplate;
use App\Models\Team;
use App\Models\TeamMember;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

/**
 * API responses that show other people must not leak private account data
 * (preferences, admin flag, SSO ids, deactivation state).
 */
class PublicUserSerializationTest extends TestCase
{
    use RefreshDatabase;

    private const PRIVATE_FIELDS = [
        'is_admin',
        'email_notification_prefs',
        'ui_preferences',
        'theme_preference',
        'auth_provider',
        'auth_provider_id',
        'deactivated_at',
        'created_by_team_id',
        'email_verified_at',
    ];

    private User $owner;

    private User $colleague;

    private Team $team;

    private Board $board;

    private Column $column;

    protected function setUp(): void
    {
        parent::setUp();

        $this->owner = User::factory()->create();
        $this->colleague = User::factory()->create([
            'is_admin' => true,
            'email_notification_prefs' => ['task_assigned' => ['email' => false]],
            'ui_preferences' => ['starred_boards' => ['secret-board']],
            'auth_provider' => 'saml',
            'auth_provider_id' => 'idp-subject-123',
        ]);
        $this->team = Team::factory()->create();
        TeamMember::create(['team_id' => $this->team->id, 'user_id' => $this->owner->id, 'role' => 'owner']);
        TeamMember::create(['team_id' => $this->team->id, 'user_id' => $this->colleague->id, 'role' => 'admin']);
        $this->board = Board::factory()->create(['team_id' => $this->team->id]);
        $this->column = Column::factory()->create(['board_id' => $this->board->id]);
    }

    private function api(array $abilities = ['read', 'write', 'manage']): static
    {
        $token = $this->owner->createToken('test', $abilities)->plainTextToken;

        return $this->withHeader('Authorization', "Bearer {$token}");
    }

    /**
     * Assert that no user-shaped object anywhere in the JSON carries a
     * private field, and that at least one user object was checked.
     */
    private function assertNoPrivateUserFields(TestResponse $response): void
    {
        $checked = 0;

        $walk = function ($value) use (&$walk, &$checked) {
            if (! is_array($value)) {
                return;
            }

            if (isset($value['email'], $value['name'], $value['id'])) {
                $checked++;
                foreach (self::PRIVATE_FIELDS as $field) {
                    $this->assertArrayNotHasKey($field, $value, "User object exposes {$field}");
                }
            }

            foreach ($value as $child) {
                $walk($child);
            }
        };

        $walk($response->json());

        $this->assertGreaterThan(0, $checked, 'Expected at least one user object in the response.');
    }

    private function makeTask(): Task
    {
        $task = Task::factory()->create([
            'board_id' => $this->board->id,
            'column_id' => $this->column->id,
            'created_by' => $this->owner->id,
        ]);
        $task->assignees()->attach($this->colleague->id, ['assigned_by' => $this->owner->id, 'assigned_at' => now()]);

        return $task;
    }

    public function test_team_members_use_the_public_shape_with_role(): void
    {
        $response = $this->api()->getJson("/api/v1/teams/{$this->team->id}/members");

        $response->assertOk();
        $colleague = collect($response->json('data'))->firstWhere('id', $this->colleague->id);

        $this->assertSame(
            ['id', 'name', 'email', 'avatar_url', 'is_bot', 'role'],
            array_keys($colleague),
        );
        $this->assertSame('admin', $colleague['role']);
        $this->assertFalse($colleague['is_bot']);
        $this->assertNoPrivateUserFields($response);
    }

    public function test_adding_and_updating_a_member_returns_the_public_user(): void
    {
        $newcomer = User::factory()->create(['is_admin' => true, 'ui_preferences' => ['x' => 1]]);

        $response = $this->api()->postJson("/api/v1/teams/{$this->team->id}/members", ['user_id' => $newcomer->id]);
        $response->assertCreated()->assertJsonPath('data.user.id', $newcomer->id);
        $this->assertNoPrivateUserFields($response);

        $response = $this->api()->putJson("/api/v1/teams/{$this->team->id}/members/{$newcomer->id}", ['role' => 'admin']);
        $response->assertOk()->assertJsonPath('data.user.id', $newcomer->id);
        $this->assertNoPrivateUserFields($response);
    }

    public function test_member_search_returns_the_public_shape(): void
    {
        User::factory()->create(['name' => 'Searchable Person', 'is_admin' => true]);

        $response = $this->api()->getJson("/api/v1/teams/{$this->team->id}/members/search?q=Searchable");

        $response->assertOk()->assertJsonCount(1, 'data');
        $this->assertNoPrivateUserFields($response);
    }

    public function test_task_list_and_show_hide_private_user_fields(): void
    {
        $task = $this->makeTask();
        Comment::create(['task_id' => $task->id, 'user_id' => $this->colleague->id, 'body' => 'Hello']);

        $list = $this->api()->getJson("/api/v1/teams/{$this->team->id}/boards/{$this->board->id}/tasks");
        $list->assertOk()->assertJsonPath('data.0.assignees.0.id', $this->colleague->id);
        $this->assertNoPrivateUserFields($list);

        $show = $this->api()->getJson("/api/v1/teams/{$this->team->id}/boards/{$this->board->id}/tasks/{$task->id}");
        $show->assertOk()
            ->assertJsonPath('data.assignees.0.id', $this->colleague->id)
            ->assertJsonPath('data.comments.0.user.id', $this->colleague->id);
        $this->assertNoPrivateUserFields($show);
    }

    public function test_assigning_returns_public_assignees(): void
    {
        $task = $this->makeTask();

        $response = $this->api()->putJson(
            "/api/v1/teams/{$this->team->id}/boards/{$this->board->id}/tasks/{$task->id}/assignees",
            ['user_ids' => [$this->colleague->id, $this->owner->id]],
        );

        $response->assertOk()->assertJsonCount(2, 'data.assignees');
        $this->assertNoPrivateUserFields($response);
    }

    public function test_comments_hide_private_user_fields(): void
    {
        $task = $this->makeTask();
        $parent = Comment::create(['task_id' => $task->id, 'user_id' => $this->colleague->id, 'body' => 'Parent']);
        Comment::create(['task_id' => $task->id, 'user_id' => $this->colleague->id, 'body' => 'Reply', 'parent_id' => $parent->id]);

        $response = $this->api()->getJson("/api/v1/teams/{$this->team->id}/boards/{$this->board->id}/tasks/{$task->id}/comments");

        $response->assertOk()->assertJsonPath('data.0.replies.0.user.id', $this->colleague->id);
        $this->assertNoPrivateUserFields($response);
    }

    public function test_my_tasks_hide_private_fields_of_co_assignees(): void
    {
        $task = $this->makeTask();
        $task->assignees()->attach($this->owner->id, ['assigned_by' => $this->owner->id, 'assigned_at' => now()]);

        $response = $this->api()->getJson('/api/v1/me/tasks');

        $response->assertOk()->assertJsonCount(2, 'data.0.assignees');
        $this->assertNoPrivateUserFields($response);
    }

    public function test_task_template_creator_is_public(): void
    {
        TaskTemplate::create([
            'team_id' => $this->team->id,
            'name' => 'Bug report',
            'priority' => 'none',
            'created_by' => $this->colleague->id,
        ]);

        $response = $this->api()->getJson("/api/v1/teams/{$this->team->id}/task-templates");

        $response->assertOk()->assertJsonPath('data.0.creator.id', $this->colleague->id);
        $this->assertNoPrivateUserFields($response);
    }

    public function test_me_still_returns_own_profile_fields(): void
    {
        $this->api()->getJson('/api/v1/me')
            ->assertOk()
            ->assertJsonPath('data.id', $this->owner->id)
            ->assertJsonStructure(['data' => ['id', 'name', 'email', 'avatar_url', 'theme_preference', 'is_bot', 'created_at']]);
    }
}
