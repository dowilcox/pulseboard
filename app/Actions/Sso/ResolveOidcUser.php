<?php

namespace App\Actions\Sso;

use App\Exceptions\OidcException;
use App\Models\SsoConfiguration;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Lorisleiva\Actions\Concerns\AsAction;

/**
 * Find, link or just-in-time create the PulseBoard user for a verified OIDC
 * identity.
 *
 * Linking rules (stricter than SAML, which links by email unconditionally):
 *  1. A user already linked to this issuer + sub is always matched.
 *  2. Otherwise, an existing account with the same email is linked ONLY when
 *     the IdP asserts email_verified = true for the standard "email" claim.
 *     Unverified emails never take over an existing account.
 *  3. Otherwise a new account is provisioned.
 * Deactivated users and bot accounts are rejected before anything is saved.
 */
class ResolveOidcUser
{
    use AsAction;

    /**
     * @param  array{provider_user_id: string, sub: string, email: ?string, email_verified: bool, name: ?string}  $identity
     */
    public function handle(SsoConfiguration $config, array $identity): User
    {
        return DB::transaction(function () use ($config, $identity) {
            $user = User::where('auth_provider', SsoConfiguration::PROVIDER_OIDC)
                ->where('auth_provider_id', $identity['provider_user_id'])
                ->lockForUpdate()
                ->first();

            if ($user) {
                $this->ensureCanSignIn($user, $config, $identity);
                $this->refreshProfile($user, $identity);

                return $user;
            }

            if ($identity['email'] === null) {
                throw new OidcException(
                    'Your identity provider did not share an email address, which PulseBoard needs to create your account.',
                    ['sub' => $identity['sub']],
                );
            }

            $existing = User::where('email', $identity['email'])->lockForUpdate()->first();

            if ($existing) {
                return $this->linkExisting($existing, $config, $identity);
            }

            $user = User::create([
                'name' => $identity['name'] ?? $identity['email'],
                'email' => $identity['email'],
                'email_verified_at' => $identity['email_verified'] ? now() : null,
                'password' => null,
                'auth_provider' => SsoConfiguration::PROVIDER_OIDC,
                'auth_provider_id' => $identity['provider_user_id'],
            ]);

            Log::info('OIDC user provisioned', $this->logContext($config, $identity, $user));

            return $user;
        });
    }

    private function linkExisting(User $user, SsoConfiguration $config, array $identity): User
    {
        $this->ensureCanSignIn($user, $config, $identity);

        if (! $identity['email_verified']) {
            Log::warning('OIDC login refused: unverified email matches an existing account', $this->logContext($config, $identity, $user));

            throw new OidcException(
                'An account with this email already exists, but your identity provider has not verified the address, so it cannot be linked automatically. Sign in with your existing method or contact an administrator.',
            );
        }

        $previousProvider = $user->auth_provider;

        $user->forceFill([
            'name' => $identity['name'] ?? $user->name,
            'email_verified_at' => $user->email_verified_at ?? now(),
            'auth_provider' => SsoConfiguration::PROVIDER_OIDC,
            'auth_provider_id' => $identity['provider_user_id'],
        ])->save();

        Log::info('OIDC identity linked to existing account', [
            ...$this->logContext($config, $identity, $user),
            'previous_provider' => $previousProvider,
        ]);

        return $user;
    }

    /**
     * Keep name/email in sync with the IdP. Email only changes when the new
     * address is verified and not already used by someone else.
     */
    private function refreshProfile(User $user, array $identity): void
    {
        if ($identity['name'] !== null) {
            $user->name = $identity['name'];
        }

        if ($identity['email'] !== null
            && $identity['email_verified']
            && $identity['email'] !== $user->email
            && ! User::where('email', $identity['email'])->whereKeyNot($user->getKey())->exists()) {
            $user->email = $identity['email'];
            $user->email_verified_at = now();
        }

        if ($user->isDirty()) {
            $user->save();
        }
    }

    private function ensureCanSignIn(User $user, SsoConfiguration $config, array $identity): void
    {
        if ($user->deactivated_at) {
            Log::warning('OIDC login refused: account deactivated', $this->logContext($config, $identity, $user));

            throw new OidcException('Your account has been deactivated.');
        }

        if ($user->is_bot) {
            Log::warning('OIDC login refused: identity matches a bot account', $this->logContext($config, $identity, $user));

            throw new OidcException('This account cannot sign in with SSO.');
        }
    }

    private function logContext(SsoConfiguration $config, array $identity, ?User $user = null): array
    {
        return array_filter([
            'config_id' => $config->id,
            'config_name' => $config->name,
            'sub' => $identity['sub'],
            'user_id' => $user?->id,
        ]);
    }
}
