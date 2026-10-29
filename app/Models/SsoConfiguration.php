<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class SsoConfiguration extends Model
{
    use HasFactory, HasUuids;

    public const PROVIDER_SAML2 = 'saml2';

    public const PROVIDER_OIDC = 'oidc';

    public const PROVIDERS = [self::PROVIDER_SAML2, self::PROVIDER_OIDC];

    public const DEFAULT_OIDC_SCOPES = 'openid profile email';

    protected $keyType = 'string';

    public $incrementing = false;

    protected $guarded = [];

    protected $hidden = ['certificate', 'client_secret'];

    protected function casts(): array
    {
        return [
            'certificate' => 'encrypted',
            'client_secret' => 'encrypted',
            'attribute_mapping' => 'array',
            'allowed_algorithms' => 'array',
            'fetch_userinfo' => 'boolean',
            'end_session_enabled' => 'boolean',
            'is_active' => 'boolean',
        ];
    }

    public function scopeActive(Builder $query): Builder
    {
        return $query->where('is_active', true);
    }

    public function scopeSaml(Builder $query): Builder
    {
        return $query->where('provider', self::PROVIDER_SAML2);
    }

    public function scopeOidc(Builder $query): Builder
    {
        return $query->where('provider', self::PROVIDER_OIDC);
    }

    public function isOidc(): bool
    {
        return $this->provider === self::PROVIDER_OIDC;
    }

    public function isSaml(): bool
    {
        return $this->provider === self::PROVIDER_SAML2;
    }

    /**
     * Text shown on the login button: "Sign in with <label>".
     */
    public function displayLabel(): string
    {
        $label = trim((string) $this->button_label);

        return $label !== '' ? $label : $this->name;
    }

    /**
     * Where the login page sends users to start this provider's flow.
     */
    public function loginUrl(): string
    {
        return $this->isOidc()
            ? route('oidc.redirect', $this)
            : route('saml.login');
    }

    /**
     * The OIDC redirect URI to register with the IdP. Built from APP_URL
     * (like the SAML ACS URL) so it never depends on the request's Host.
     */
    public static function oidcRedirectUriFor(string $id): string
    {
        return rtrim((string) config('app.url'), '/').'/auth/oidc/'.$id.'/callback';
    }

    public static function oidcPostLogoutRedirectUri(): string
    {
        return rtrim((string) config('app.url'), '/').'/login';
    }

    public function oidcRedirectUri(): string
    {
        return self::oidcRedirectUriFor($this->getKey());
    }
}
