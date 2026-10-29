<?php

namespace App\Http\Controllers\Admin;

use App\Actions\Sso\CreateSsoConfiguration;
use App\Actions\Sso\UpdateSsoConfiguration;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\StoreSsoConfigurationRequest;
use App\Http\Requests\Admin\UpdateSsoConfigurationRequest;
use App\Models\SsoConfiguration;
use App\Services\OidcService;
use App\Services\SamlService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Redirect;
use Inertia\Inertia;
use Inertia\Response;
use OneLogin\Saml2\Settings;

class SsoConfigurationController extends Controller
{
    public function index(): Response
    {
        $configurations = SsoConfiguration::orderBy('name')
            ->get()
            ->map(fn (SsoConfiguration $config) => $this->present($config))
            ->values();

        $appUrl = rtrim((string) config('app.url'), '/');

        return Inertia::render('Admin/SsoConfiguration', [
            'configurations' => $configurations,
            // Lets the create form show the exact OIDC redirect URI before saving.
            'newConfigurationId' => (new SsoConfiguration)->newUniqueId(),
            'oidcRedirectUriTemplate' => SsoConfiguration::oidcRedirectUriFor('{id}'),
            'oidcPostLogoutRedirectUri' => SsoConfiguration::oidcPostLogoutRedirectUri(),
            'samlServiceProvider' => [
                'entity_id' => $appUrl.'/auth/saml/metadata',
                'acs_url' => $appUrl.'/auth/saml/acs',
            ],
            'oidcAlgorithms' => [
                'asymmetric' => OidcService::ASYMMETRIC_ALGORITHMS,
                'symmetric' => OidcService::SYMMETRIC_ALGORITHMS,
            ],
        ]);
    }

    public function store(StoreSsoConfigurationRequest $request): RedirectResponse
    {
        CreateSsoConfiguration::run($request->validated());

        return Redirect::route('admin.sso.index')
            ->with('success', 'SSO provider created successfully.');
    }

    public function update(UpdateSsoConfigurationRequest $request, SsoConfiguration $ssoConfiguration): RedirectResponse
    {
        UpdateSsoConfiguration::run($ssoConfiguration, $request->validated());

        return Redirect::route('admin.sso.index')
            ->with('success', 'SSO provider updated successfully.');
    }

    public function destroy(SsoConfiguration $ssoConfiguration, OidcService $oidc): RedirectResponse
    {
        if ($ssoConfiguration->isOidc()) {
            $oidc->forgetCache($ssoConfiguration->issuer);
        }

        $ssoConfiguration->delete();

        return Redirect::route('admin.sso.index')
            ->with('success', 'SSO provider deleted successfully.');
    }

    public function test(SsoConfiguration $ssoConfiguration, SamlService $samlService, OidcService $oidc): JsonResponse
    {
        if ($ssoConfiguration->isOidc()) {
            $result = $oidc->testConfiguration($ssoConfiguration);

            if (! $result['success']) {
                Log::warning('OIDC configuration test failed', [
                    'config_id' => $ssoConfiguration->id,
                    'error' => $result['message'],
                ]);
            }

            return response()->json($result, $result['success'] ? 200 : 422);
        }

        try {
            $settings = $samlService->buildSettings($ssoConfiguration);

            // Validate the settings can be constructed
            new Settings($settings, true);

            return response()->json([
                'success' => true,
                'message' => 'SAML configuration is valid.',
            ]);
        } catch (\Throwable $e) {
            Log::warning('SSO configuration test failed', [
                'config_id' => $ssoConfiguration->id,
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Configuration validation failed. Please check your settings.',
            ], 422);
        }
    }

    /**
     * Admin-facing shape. Secrets (certificate, client_secret) are never
     * sent back; the UI only learns whether one is stored.
     */
    private function present(SsoConfiguration $config): array
    {
        $base = [
            'id' => $config->id,
            'provider' => $config->provider,
            'name' => $config->name,
            'button_label' => $config->button_label,
            'attribute_mapping' => $config->attribute_mapping,
            'is_active' => $config->is_active,
            'created_at' => $config->created_at,
            'updated_at' => $config->updated_at,
        ];

        if ($config->isOidc()) {
            return [
                ...$base,
                'issuer' => $config->issuer,
                'client_id' => $config->client_id,
                'has_client_secret' => filled($config->getRawOriginal('client_secret')),
                'scopes' => $config->scopes ?: SsoConfiguration::DEFAULT_OIDC_SCOPES,
                'allowed_algorithms' => $config->allowed_algorithms,
                'fetch_userinfo' => $config->fetch_userinfo,
                'end_session_enabled' => $config->end_session_enabled,
                'redirect_uri' => $config->oidcRedirectUri(),
            ];
        }

        return [
            ...$base,
            'entity_id' => $config->entity_id,
            'login_url' => $config->login_url,
            'logout_url' => $config->logout_url,
            'metadata_url' => $config->metadata_url,
            'has_certificate' => filled($config->getRawOriginal('certificate')),
        ];
    }
}
