<?php

namespace App\Http\Requests\Admin;

use App\Models\SsoConfiguration;
use Illuminate\Validation\Rule;

class StoreSsoConfigurationRequest extends SsoConfigurationRequest
{
    public function rules(): array
    {
        return [
            // Older clients only knew SAML, so the provider defaults to it.
            'provider' => ['sometimes', 'string', Rule::in(SsoConfiguration::PROVIDERS)],
            // Optional pre-generated id, so the admin can copy the OIDC
            // redirect URI into the IdP before saving.
            'id' => ['nullable', 'uuid', Rule::unique('sso_configurations', 'id')],
            ...parent::rules(),
        ];
    }

    protected function provider(): ?string
    {
        $provider = $this->input('provider', SsoConfiguration::PROVIDER_SAML2);

        return in_array($provider, SsoConfiguration::PROVIDERS, true) ? $provider : null;
    }

    protected function isCreating(): bool
    {
        return true;
    }

    protected function existing(): ?SsoConfiguration
    {
        return null;
    }
}
