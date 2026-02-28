<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\SsoConfiguration;
use App\Services\SamlService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Redirect;
use Inertia\Inertia;
use Inertia\Response;

class SsoConfigurationController extends Controller
{
    public function index(): Response
    {
        $configurations = SsoConfiguration::orderBy('name')->get();

        return Inertia::render('Admin/SsoConfiguration', [
            'configurations' => $configurations,
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'entity_id' => ['required', 'string', 'max:500'],
            'login_url' => ['required', 'url', 'max:500'],
            'logout_url' => ['nullable', 'url', 'max:500'],
            'certificate' => ['required', 'string'],
            'metadata_url' => ['nullable', 'url', 'max:500'],
            'attribute_mapping' => ['nullable', 'array'],
            'attribute_mapping.email' => ['nullable', 'string'],
            'attribute_mapping.name' => ['nullable', 'string'],
            'is_active' => ['boolean'],
        ]);

        SsoConfiguration::create($validated);

        return Redirect::route('admin.sso.index');
    }

    public function update(Request $request, SsoConfiguration $ssoConfiguration): RedirectResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'entity_id' => ['required', 'string', 'max:500'],
            'login_url' => ['required', 'url', 'max:500'],
            'logout_url' => ['nullable', 'url', 'max:500'],
            'certificate' => ['nullable', 'string'],
            'metadata_url' => ['nullable', 'url', 'max:500'],
            'attribute_mapping' => ['nullable', 'array'],
            'attribute_mapping.email' => ['nullable', 'string'],
            'attribute_mapping.name' => ['nullable', 'string'],
            'is_active' => ['boolean'],
        ]);

        // Don't overwrite certificate if not provided
        if (empty($validated['certificate'])) {
            unset($validated['certificate']);
        }

        $ssoConfiguration->update($validated);

        return Redirect::route('admin.sso.index');
    }

    public function destroy(SsoConfiguration $ssoConfiguration): RedirectResponse
    {
        $ssoConfiguration->delete();

        return Redirect::route('admin.sso.index');
    }

    public function test(SsoConfiguration $ssoConfiguration, SamlService $samlService): JsonResponse
    {
        try {
            $settings = $samlService->buildSettings($ssoConfiguration);

            // Validate the settings can be constructed
            new \OneLogin\Saml2\Settings($settings, true);

            return response()->json([
                'success' => true,
                'message' => 'SAML configuration is valid.',
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 422);
        }
    }
}
