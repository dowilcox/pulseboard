<?php

namespace App\Console\Commands;

use App\Models\AppSetting;
use App\Models\SsoConfiguration;
use Illuminate\Console\Command;

class ToggleLocalAuth extends Command
{
    protected $signature = 'auth:local
        {--enable : Enable local (password) authentication}
        {--disable : Disable local authentication (requires active SSO)}';

    protected $description = 'Enable or disable local password authentication';

    public function handle(): int
    {
        if ($this->option('enable') && $this->option('disable')) {
            $this->error('Cannot use --enable and --disable together.');

            return self::FAILURE;
        }

        if ($this->option('disable')) {
            return $this->disableLocalAuth();
        }

        if ($this->option('enable')) {
            return $this->enableLocalAuth();
        }

        // No flag — show current status
        $disabled = AppSetting::isLocalAuthDisabled();
        $ssoActive = SsoConfiguration::where('is_active', true)->exists();

        $this->info('Local authentication: '.($disabled ? 'DISABLED' : 'ENABLED'));
        $this->info('Active SSO configuration: '.($ssoActive ? 'YES' : 'NO'));

        if ($disabled && ! $ssoActive) {
            $this->warn('Warning: Local auth is disabled but no SSO is active. Users cannot log in!');
            $this->warn('Run: php artisan auth:local --enable');
        }

        return self::SUCCESS;
    }

    private function disableLocalAuth(): int
    {
        $ssoActive = SsoConfiguration::where('is_active', true)->exists();

        if (! $ssoActive) {
            $this->error('Cannot disable local auth — no active SSO configuration exists.');
            $this->error('Users would be locked out with no way to log in.');

            return self::FAILURE;
        }

        if (! $this->confirm('This will prevent all users from logging in with email/password. Continue?')) {
            return self::SUCCESS;
        }

        AppSetting::set('local_auth_disabled', '1');
        $this->info('Local authentication has been DISABLED. Users must use SSO to log in.');

        return self::SUCCESS;
    }

    private function enableLocalAuth(): int
    {
        AppSetting::set('local_auth_disabled', '0');
        $this->info('Local authentication has been ENABLED. Users can log in with email/password.');

        return self::SUCCESS;
    }
}
