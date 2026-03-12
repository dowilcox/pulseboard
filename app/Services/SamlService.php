<?php

namespace App\Services;

use App\Models\SsoConfiguration;
use Illuminate\Support\Facades\Log;
use OneLogin\Saml2\Auth as SamlAuth;
use OneLogin\Saml2\Settings as SamlSettings;
use OneLogin\Saml2\Utils as SamlUtils;

class SamlService
{
    public function buildSettings(SsoConfiguration $config): array
    {
        $mapping = $config->attribute_mapping ?? [
            'email' => 'urn:oid:0.9.2342.19200300.100.1.3',
            'name' => 'urn:oid:2.16.840.1.113730.3.1.241',
        ];

        return [
            'strict' => true,
            'debug' => config('app.debug'),
            'baseurl' => config('app.url').'/auth/saml/',
            'sp' => [
                'entityId' => config('app.url').'/auth/saml/metadata',
                'assertionConsumerService' => [
                    'url' => config('app.url').'/auth/saml/acs',
                    'binding' => 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST',
                ],
                'NameIDFormat' => 'urn:oasis:names:tc:SAML:2.0:nameid-format:emailAddress',
            ],
            'idp' => [
                'entityId' => $config->entity_id,
                'singleSignOnService' => [
                    'url' => $config->login_url,
                    'binding' => 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect',
                ],
                'singleLogoutService' => [
                    'url' => $config->logout_url ?? '',
                    'binding' => 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect',
                ],
                'x509cert' => $this->normalizeCertificate($config->certificate),
            ],
            'security' => [
                'authnRequestsSigned' => false,
                'wantAssertionsSigned' => true,
                'wantNameIdEncrypted' => false,
            ],
        ];
    }

    public function createAuth(SsoConfiguration $config): SamlAuth
    {
        SamlUtils::setProxyVars(true);

        return new SamlAuth($this->buildSettings($config));
    }

    public function initiateLogin(SsoConfiguration $config): string
    {
        $auth = $this->createAuth($config);

        return $auth->login(null, [], false, false, true);
    }

    public function processResponse(SsoConfiguration $config): array
    {
        $cert = $this->normalizeCertificate($config->certificate);

        Log::debug('SAML certificate diagnostic', [
            'config_name' => $config->name,
            'cert_length' => strlen($cert),
            'cert_starts_with' => substr($cert, 0, 20),
            'is_base64' => base64_decode($cert, true) !== false,
        ]);

        $auth = $this->createAuth($config);
        $auth->processResponse();

        if ($auth->getErrors()) {
            $reason = $auth->getLastErrorReason() ?: 'No additional details';

            Log::error('SAML response processing failed', [
                'errors' => $auth->getErrors(),
                'reason' => $reason,
                'config_id' => $config->id,
                'config_name' => $config->name,
            ]);

            throw new \RuntimeException('SAML Error: '.implode(', ', $auth->getErrors()).' — '.$reason);
        }

        if (! $auth->isAuthenticated()) {
            Log::warning('SAML response not authenticated', [
                'config_id' => $config->id,
            ]);

            throw new \RuntimeException('SAML authentication failed.');
        }

        $mapping = $config->attribute_mapping ?? [
            'email' => 'urn:oid:0.9.2342.19200300.100.1.3',
            'name' => 'urn:oid:2.16.840.1.113730.3.1.241',
        ];

        $attributes = $auth->getAttributes();
        $nameId = $auth->getNameId();

        Log::info('SAML authentication successful', [
            'name_id' => $nameId,
            'attributes' => array_keys($attributes),
            'config_name' => $config->name,
        ]);

        return [
            'name_id' => $nameId,
            'email' => $this->getAttribute($attributes, $mapping['email'] ?? '', $nameId),
            'name' => $this->getAttribute($attributes, $mapping['name'] ?? '', $nameId),
        ];
    }

    public function getMetadata(SsoConfiguration $config): string
    {
        $settings = new SamlSettings($this->buildSettings($config), true);

        return $settings->getSPMetadata();
    }

    private function normalizeCertificate(string $cert): string
    {
        $cert = str_replace([
            '-----BEGIN CERTIFICATE-----',
            '-----END CERTIFICATE-----',
            "\r\n",
            "\r",
            "\n",
            ' ',
        ], '', $cert);

        return trim($cert);
    }

    private function getAttribute(array $attributes, string $key, string $fallback): string
    {
        if (! empty($key) && isset($attributes[$key])) {
            return is_array($attributes[$key]) ? $attributes[$key][0] : $attributes[$key];
        }

        return $fallback;
    }
}
