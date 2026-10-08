<?php

namespace Tests\Feature;

use App\Models\Label;
use App\Models\Team;
use App\Models\TeamMember;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

/**
 * Team settings page (tabs, permissions), team details, labels, member roles
 * and the legacy integration/bot URLs that now redirect into settings tabs.
 */
class TeamSettingsTest extends TestCase
{
    use RefreshDatabase;

    private Team $team;

    private User $owner;

    private User $admin;

    private User $member;

    protected function setUp(): void
    {
        parent::setUp();

        $this->team = Team::factory()->create(['name' => 'Acme', 'slug' => 'acme']);
        $this->owner = $this->addMember('owner');
        $this->admin = $this->addMember('admin');
        $this->member = $this->addMember('member');
    }

    private function addMember(string $role): User
    {
        $user = User::factory()->create();
        TeamMember::create([
            'team_id' => $this->team->id,
            'user_id' => $user->id,
            'role' => $role,
        ]);

        return $user;
    }

    // ---------------------------------------------------------------
    // Settings page permissions
    // ---------------------------------------------------------------

    public function test_member_gets_read_only_settings(): void
    {
        $this->actingAs($this->member)
            ->get(route('teams.settings', $this->team))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Teams/Settings')
                ->where('can.updateTeam', false)
                ->where('can.manageMembers', false)
                ->where('can.manageAdmins', false)
                ->where('can.manageLabels', false)
                ->where('can.manageIntegrations', false)
                ->where('can.manageBots', false)
                ->where('can.deleteTeam', false)
                ->where('gitlab', null)
                ->where('figmaConnections', null)
                ->where('bots', null)
            );
    }

    public function test_admin_can_manage_everything_but_owners_and_deletion(): void
    {
        $this->actingAs($this->admin)
            ->get(route('teams.settings', $this->team))
            ->assertInertia(fn (Assert $page) => $page
                ->where('can.updateTeam', true)
                ->where('can.manageMembers', true)
                ->where('can.manageAdmins', false)
                ->where('can.manageLabels', true)
                ->where('can.manageIntegrations', true)
                ->where('can.manageBots', true)
                ->where('can.deleteTeam', false)
                ->has('gitlab.projects')
                ->has('gitlab.connections')
                ->has('gitlab.activeConnections')
                ->has('figmaConnections')
                ->has('bots')
            );
    }

    public function test_owner_can_delete_team_and_manage_admins(): void
    {
        $this->actingAs($this->owner)
            ->get(route('teams.settings', $this->team))
            ->assertInertia(fn (Assert $page) => $page
                ->where('can.manageAdmins', true)
                ->where('can.deleteTeam', true)
            );
    }

    public function test_settings_passes_requested_tab_and_upload_rules(): void
    {
        $this->actingAs($this->owner)
            ->get(route('teams.settings', ['team' => $this->team, 'tab' => 'labels']))
            ->assertInertia(fn (Assert $page) => $page
                ->where('tab', 'labels')
                ->has('imageUpload.maxSize')
                ->has('imageUpload.types')
            );
    }

    public function test_settings_lists_deactivated_members_separately(): void
    {
        $gone = $this->addMember('member');
        $gone->update(['deactivated_at' => now()]);

        $this->actingAs($this->owner)
            ->get(route('teams.settings', $this->team))
            ->assertInertia(fn (Assert $page) => $page
                ->has('members', 3)
                ->has('deactivatedMembers', 1)
                ->where('deactivatedMembers.0.id', $gone->id)
            );
    }

    // ---------------------------------------------------------------
    // Team details (teams.update)
    // ---------------------------------------------------------------

    public function test_admin_can_update_team_details(): void
    {
        $this->actingAs($this->admin)
            ->put(route('teams.update', $this->team), [
                'name' => 'Acme Labs',
                'description' => 'We build things.',
            ])
            ->assertRedirect(route('teams.settings', ['team' => 'acme-labs', 'tab' => 'general']))
            ->assertSessionHas('success', 'Team details saved.');

        $this->team->refresh();
        $this->assertSame('Acme Labs', $this->team->name);
        $this->assertSame('acme-labs', $this->team->slug);
        $this->assertSame('We build things.', $this->team->description);
    }

    public function test_description_can_be_cleared(): void
    {
        $this->team->update(['description' => 'Old']);

        $this->actingAs($this->owner)
            ->put(route('teams.update', $this->team), [
                'name' => 'Acme',
                'description' => null,
            ])
            ->assertSessionHasNoErrors();

        $this->assertNull($this->team->fresh()->description);
    }

    public function test_team_update_validates_input(): void
    {
        $this->actingAs($this->owner)
            ->from(route('teams.settings', $this->team))
            ->put(route('teams.update', $this->team), [
                'name' => '',
                'description' => str_repeat('a', 1001),
            ])
            ->assertRedirect(route('teams.settings', $this->team))
            ->assertSessionHasErrors(['name', 'description']);

        $this->assertSame('Acme', $this->team->fresh()->name);
    }

    public function test_member_cannot_update_team_details(): void
    {
        $this->actingAs($this->member)
            ->put(route('teams.update', $this->team), ['name' => 'Hijacked'])
            ->assertForbidden();

        $this->assertSame('Acme', $this->team->fresh()->name);
    }

    // ---------------------------------------------------------------
    // Labels
    // ---------------------------------------------------------------

    public function test_label_mutations_redirect_back_with_flash(): void
    {
        $from = route('teams.settings', ['team' => $this->team, 'tab' => 'labels']);

        $this->actingAs($this->admin)
            ->from($from)
            ->post(route('labels.store', $this->team), ['name' => 'Bug', 'color' => '#ff0000'])
            ->assertRedirect($from)
            ->assertSessionHas('success', 'Label “Bug” created.');

        $label = Label::where('team_id', $this->team->id)->firstOrFail();

        $this->actingAs($this->admin)
            ->from($from)
            ->put(route('labels.update', [$this->team, $label]), ['name' => 'Defect'])
            ->assertRedirect($from)
            ->assertSessionHas('success', 'Label “Defect” updated.');

        $this->actingAs($this->admin)
            ->from($from)
            ->delete(route('labels.destroy', [$this->team, $label]))
            ->assertRedirect($from)
            ->assertSessionHas('success', 'Label “Defect” deleted.');

        $this->assertDatabaseMissing('labels', ['id' => $label->id]);
    }

    public function test_member_cannot_manage_labels(): void
    {
        $this->actingAs($this->member)
            ->post(route('labels.store', $this->team), ['name' => 'Bug', 'color' => '#ff0000'])
            ->assertForbidden();
    }

    // ---------------------------------------------------------------
    // Member roles
    // ---------------------------------------------------------------

    public function test_role_change_redirects_to_members_tab_with_message(): void
    {
        $this->actingAs($this->owner)
            ->put(route('teams.members.update', [$this->team, $this->member]), ['role' => 'admin'])
            ->assertRedirect(route('teams.settings', ['team' => $this->team, 'tab' => 'members']))
            ->assertSessionHas('success', "{$this->member->name} is now an admin.");
    }

    public function test_owner_demoting_themselves_gets_personal_message(): void
    {
        $secondOwner = $this->addMember('owner');

        $this->actingAs($this->owner)
            ->put(route('teams.members.update', [$this->team, $this->owner]), ['role' => 'admin'])
            ->assertSessionHas('success', 'You are now an admin.');

        $this->assertDatabaseHas('team_members', [
            'team_id' => $this->team->id,
            'user_id' => $secondOwner->id,
            'role' => 'owner',
        ]);
    }

    public function test_last_owner_cannot_demote_themselves(): void
    {
        $this->actingAs($this->owner)
            ->put(route('teams.members.update', [$this->team, $this->owner]), ['role' => 'admin'])
            ->assertSessionHasErrors('role');

        $this->assertDatabaseHas('team_members', [
            'team_id' => $this->team->id,
            'user_id' => $this->owner->id,
            'role' => 'owner',
        ]);
    }

    public function test_admin_cannot_promote_to_owner(): void
    {
        $this->actingAs($this->admin)
            ->put(route('teams.members.update', [$this->team, $this->member]), ['role' => 'owner'])
            ->assertForbidden();
    }

    // ---------------------------------------------------------------
    // Legacy URLs now live in settings tabs
    // ---------------------------------------------------------------

    public function test_legacy_integration_urls_redirect_to_settings_tabs(): void
    {
        $this->actingAs($this->admin)
            ->get(route('teams.gitlab-projects.index', $this->team))
            ->assertRedirect(route('teams.settings', ['team' => $this->team, 'tab' => 'integrations']));

        $this->actingAs($this->admin)
            ->get(route('teams.figma.index', $this->team))
            ->assertRedirect(route('teams.settings', ['team' => $this->team, 'tab' => 'integrations']));

        $this->actingAs($this->admin)
            ->get(route('teams.bots.index', $this->team))
            ->assertRedirect(route('teams.settings', ['team' => $this->team, 'tab' => 'api']));
    }

    public function test_gitlab_connection_mutations_land_on_integrations_tab_with_flash(): void
    {
        $this->actingAs($this->admin)
            ->followingRedirects()
            ->post(route('teams.gitlab-connections.store', $this->team), [
                'name' => 'Company GitLab',
                'base_url' => 'https://gitlab.example.com',
                'api_token' => 'glpat-secret',
                'is_active' => true,
            ])
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Teams/Settings')
                ->where('tab', 'integrations')
                ->where('flash.success', 'GitLab connection created successfully.')
                ->has('gitlab.connections', 1)
            );
    }

    public function test_members_cannot_open_legacy_integration_urls(): void
    {
        $this->actingAs($this->member)
            ->get(route('teams.gitlab-projects.index', $this->team))
            ->assertForbidden();

        $this->actingAs($this->member)
            ->get(route('teams.figma.index', $this->team))
            ->assertForbidden();
    }

    public function test_figma_connection_mutations_redirect_back_with_flash(): void
    {
        $from = route('teams.settings', ['team' => $this->team, 'tab' => 'integrations']);

        $this->actingAs($this->admin)
            ->from($from)
            ->post(route('teams.figma-connections.store', $this->team), [
                'name' => 'Design',
                'api_token' => 'figd_secret',
                'is_active' => true,
            ])
            ->assertRedirect($from)
            ->assertSessionHas('success', 'Figma connection created.');
    }
}
