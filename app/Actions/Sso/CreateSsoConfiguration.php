<?php

namespace App\Actions\Sso;

use App\Models\SsoConfiguration;
use Lorisleiva\Actions\Concerns\AsAction;

class CreateSsoConfiguration
{
    use AsAction;

    public function handle(array $data): SsoConfiguration
    {
        $provider = $data['provider'] ?? SsoConfiguration::PROVIDER_SAML2;

        $config = new SsoConfiguration([
            'provider' => $provider,
            ...SsoConfigurationAttributes::from($provider, $data),
        ]);

        if (! empty($data['id'])) {
            $config->id = $data['id'];
        }

        $config->save();

        return $config;
    }
}
