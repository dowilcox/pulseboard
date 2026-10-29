<?php

namespace App\Actions\Sso;

use App\Models\SsoConfiguration;
use App\Services\OidcService;
use Illuminate\Support\Arr;

/**
 * Picks the columns relevant to a provider type out of validated input, so
 * a SAML row never stores OIDC fields and vice versa.
 */
final class SsoConfigurationAttributes
{
    private const COMMON = ['name', 'button_label', 'is_active', 'attribute_mapping'];

    private const SAML = ['entity_id', 'login_url', 'logout_url', 'certificate', 'metadata_url'];

    private const OIDC = [
        'issuer', 'client_id', 'client_secret', 'scopes',
        'allowed_algorithms', 'fetch_userinfo', 'end_session_enabled',
    ];

    public static function from(string $provider, array $data): array
    {
        $isOidc = $provider === SsoConfiguration::PROVIDER_OIDC;
        $attributes = Arr::only($data, [...self::COMMON, ...($isOidc ? self::OIDC : self::SAML)]);

        if (array_key_exists('button_label', $attributes)) {
            $attributes['button_label'] = filled($attributes['button_label']) ? trim($attributes['button_label']) : null;
        }

        if (array_key_exists('attribute_mapping', $attributes)) {
            $attributes['attribute_mapping'] = self::mapping($attributes['attribute_mapping']);
        }

        if ($isOidc) {
            if (array_key_exists('scopes', $attributes)) {
                $attributes['scopes'] = OidcService::normalizeScopes($attributes['scopes']);
            }

            if (array_key_exists('allowed_algorithms', $attributes)) {
                $algorithms = array_values(array_unique((array) $attributes['allowed_algorithms']));
                $attributes['allowed_algorithms'] = $algorithms !== [] ? $algorithms : null;
            }
        }

        return $attributes;
    }

    private static function mapping(?array $mapping): ?array
    {
        $mapping = array_filter(
            Arr::only($mapping ?? [], ['email', 'name']),
            fn ($value) => is_string($value) && trim($value) !== '',
        );

        return $mapping !== [] ? array_map('trim', $mapping) : null;
    }
}
