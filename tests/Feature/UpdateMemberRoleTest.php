<?php

namespace Tests\Feature;

use App\Actions\Teams\UpdateMemberRole;
use App\Models\Team;
use App\Models\TeamMember;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

class UpdateMemberRoleTest extends TestCase
{
    use RefreshDatabase;

    private Team $team;

    protected function setUp(): void
    {
        parent::setUp();
        $this->team = Team::factory()->create();
    }

    private function addMember(User $user, string $role = 'member'): void
    {
        TeamMember::create([
            'team_id' => $this->team->id,
            'user_id' => $user->id,
            'role' => $role,
        ]);
    }

    public function test_can_promote_member_to_admin(): void
    {
        $member = User::factory()->create();
        $this->addMember($member);

        $result = UpdateMemberRole::run($this->team, $member, 'admin');

        $this->assertEquals('admin', $result->role);
    }

    public function test_can_promote_member_to_owner(): void
    {
        $member = User::factory()->create();
        $this->addMember($member);

        $result = UpdateMemberRole::run($this->team, $member, 'owner');

        $this->assertEquals('owner', $result->role);
    }

    public function test_can_demote_admin_to_member(): void
    {
        $admin = User::factory()->create();
        $this->addMember($admin, 'admin');

        $result = UpdateMemberRole::run($this->team, $admin, 'member');

        $this->assertEquals('member', $result->role);
    }

    public function test_can_demote_owner_when_multiple_owners(): void
    {
        $owner1 = User::factory()->create();
        $owner2 = User::factory()->create();
        $this->addMember($owner1, 'owner');
        $this->addMember($owner2, 'owner');

        $result = UpdateMemberRole::run($this->team, $owner1, 'admin');

        $this->assertEquals('admin', $result->role);
    }

    public function test_cannot_demote_last_owner(): void
    {
        $owner = User::factory()->create();
        $this->addMember($owner, 'owner');

        $this->expectException(ValidationException::class);
        UpdateMemberRole::run($this->team, $owner, 'admin');
    }

    public function test_cannot_update_role_of_non_member(): void
    {
        $nonMember = User::factory()->create();

        $this->expectException(ValidationException::class);
        UpdateMemberRole::run($this->team, $nonMember, 'admin');
    }

    public function test_setting_owner_to_owner_is_allowed(): void
    {
        $owner = User::factory()->create();
        $this->addMember($owner, 'owner');

        // This should not throw even though it's the last owner,
        // because the role isn't actually changing
        $result = UpdateMemberRole::run($this->team, $owner, 'owner');

        $this->assertEquals('owner', $result->role);
    }
}
