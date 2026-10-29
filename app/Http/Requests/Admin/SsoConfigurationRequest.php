<?php

namespace App\Http\Requests\Admin;

use App\Models\SsoConfiguration;
use App\Services\OidcService;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

/**
 * Shared, provider-aware validation for creating and updating SSO
 * configurations. Store requires secrets; update keeps them when blank.
 */
abstract class SsoConfigurationRequest extends FormRequest
{
    /** The provider being validated (from input on store, from the model on update). */
    abstract protected function provider(): ?string;

    abstract protected function isCreating(): bool;

    abstract protected function existing(): ?SsoConfiguration;

    public function authorize(): bool
    {
        // Routes sit behind the "admin" middleware.
        return (bool) $this->user()?->is_admin;
    }

    public function rules(): array
    {
        $common = [
            'name' => ['required', 'string', 'max:255'],
            'button_label' => ['nullable', 'string', 'max:100'],
            'is_active' => ['boolean'],
            'attribute_mapping' => ['nullable', 'array'],
            'attribute_mapping.email' => ['nullable', 'string', 'max:255'],
            'attribute_mapping.name' => ['nullable', 'string', 'max:255'],
        ];

        return match ($this->provider()) {
            SsoConfiguration::PROVIDER_OIDC => [...$common, ...$this->oidcRules()],
            default => [...$common, ...$this->samlRules()],
        };
    }

    public function after(): array
    {
        return [
            function (Validator $validator) {
                if ($validator->errors()->isNotEmpty()
                    || $this->provider() !== SsoConfiguration::PROVIDER_SAML2
                    || ! $this->boolean('is_active')) {
                    return;
                }

                // The SAML endpoints (/auth/saml/*) are not per-configuration,
                // so only one SAML provider can be live at a time. OIDC
                // providers have their own URLs and may all be active.
                $otherActive = SsoConfiguration::saml()
                    ->active()
                    ->when($this->existing(), fn ($query, $existing) => $query->whereKeyNot($existing->getKey()))
                    ->first();

                if ($otherActive) {
                    $validator->errors()->add(
                        'is_active',
                        "Only one SAML2 provider can be active at a time. Deactivate \"{$otherActive->name}\" first.",
                    );
                }
            },
        ];
    }

    protected function prepareForValidation(): void
    {
        foreach (['issuer', 'client_id', 'entity_id', 'login_url', 'logout_url', 'metadata_url'] as $field) {
            if (is_string($this->input($field))) {
                $this->merge([$field => trim($this->input($field))]);
            }
        }
    }

    private function samlRules(): array
    {
        return [
            'entity_id' => ['required', 'string', 'max:500'],
            'login_url' => ['required', 'url', 'max:500'],
            'logout_url' => ['nullable', 'url', 'max:500'],
            'certificate' => [$this->isCreating() ? 'required' : 'nullable', 'string'],
            'metadata_url' => ['nullable', 'url', 'max:500'],
        ];
    }

    private function oidcRules(): array
    {
        $schemes = OidcService::allowsInsecureUrls() ? 'url:http,https' : 'url:https';

        return [
            'issuer' => ['required', 'string', $schemes, 'max:500'],
            'client_id' => ['required', 'string', 'max:255'],
            'client_secret' => [$this->isCreating() ? 'required' : 'nullable', 'string', 'max:2000'],
            'scopes' => ['nullable', 'string', 'max:500', function (string $attribute, mixed $value, \Closure $fail) {
                if (is_string($value) && preg_match('/[^\x21-\x7E\s,]/', $value)) {
                    $fail('Scopes may only contain printable ASCII characters.');
                }
            }],
            'allowed_algorithms' => ['nullable', 'array'],
            'allowed_algorithms.*' => ['string', Rule::in(OidcService::SUPPORTED_ALGORITHMS)],
            'fetch_userinfo' => ['boolean'],
            'end_session_enabled' => ['boolean'],
        ];
    }

    public function messages(): array
    {
        return [
            'issuer.url' => OidcService::allowsInsecureUrls()
                ? 'The issuer must be a valid URL.'
                : 'The issuer must be a valid https:// URL.',
            'allowed_algorithms.*.in' => 'Unsupported signing algorithm.',
        ];
    }
}
