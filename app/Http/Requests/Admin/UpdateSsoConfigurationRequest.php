<?php

namespace App\Http\Requests\Admin;

use App\Models\SsoConfiguration;

/**
 * The provider type is fixed once created; delete and re-create to switch.
 */
class UpdateSsoConfigurationRequest extends SsoConfigurationRequest
{
    protected function provider(): ?string
    {
        return $this->existing()?->provider;
    }

    protected function isCreating(): bool
    {
        return false;
    }

    protected function existing(): ?SsoConfiguration
    {
        $config = $this->route('ssoConfiguration');

        return $config instanceof SsoConfiguration ? $config : null;
    }
}
