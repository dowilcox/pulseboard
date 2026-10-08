<?php

namespace Tests\Feature\Auth;

use App\Models\AppSetting;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia;
use Tests\TestCase;

class LoginRegisterLinkTest extends TestCase
{
    use RefreshDatabase;

    public function test_login_page_offers_registration_when_local_auth_is_enabled(): void
    {
        $this->get(route('login'))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('Auth/Login')
                ->where('canRegister', true)
                ->where('localAuthEnabled', true));
    }

    public function test_login_page_hides_registration_when_local_auth_is_disabled(): void
    {
        AppSetting::set('local_auth_disabled', '1');

        $this->get(route('login'))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('Auth/Login')
                ->where('canRegister', false)
                ->where('localAuthEnabled', false));
    }
}
