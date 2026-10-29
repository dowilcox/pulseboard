<?php

namespace App\Actions\Sso;

use App\Models\SsoConfiguration;
use App\Services\OidcService;
use Lorisleiva\Actions\Concerns\AsAction;

class UpdateSsoConfiguration
{
    use AsAction;

    public function __construct(
        private OidcService $oidc,
    ) {}

    public function handle(SsoConfiguration $config, array $data): SsoConfiguration
    {
        $attributes = SsoConfigurationAttributes::from($config->provider, $data);

        // Secrets are write-only: a blank field means "keep the current one".
        foreach (['certificate', 'client_secret'] as $secret) {
            if (array_key_exists($secret, $attributes) && blank($attributes[$secret])) {
                unset($attributes[$secret]);
            }
        }

        $previousIssuer = $config->issuer;

        $config->update($attributes);

        if ($config->isOidc()) {
            // Discovery/JWKS are cached per issuer; drop stale entries.
            $this->oidc->forgetCache($previousIssuer);
            $this->oidc->forgetCache($config->issuer);
        }

        return $config;
    }
}
