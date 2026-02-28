<?php

namespace App\Services;

use App\Models\SsoConfiguration;
use OneLogin\Saml2\Auth as SamlAuth;
use OneLogin\Saml2\Settings as SamlSettings;

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
            'sp' => [
                'entityId' => url('/auth/saml/metadata'),
                'assertionConsumerService' => [
                    'url' => url('/auth/saml/acs'),
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
                'x509cert' => $config->certificate,
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
        return new SamlAuth($this->buildSettings($config));
    }

    public function initiateLogin(SsoConfiguration $config): string
    {
        $auth = $this->createAuth($config);

        return $auth->login(null, [], false, false, true);
    }

    public function processResponse(SsoConfiguration $config): array
    {
        $auth = $this->createAuth($config);
        $auth->processResponse();

        if ($auth->getErrors()) {
            throw new \RuntimeException('SAML Error: '.implode(', ', $auth->getErrors()));
        }

        if (! $auth->isAuthenticated()) {
            throw new \RuntimeException('SAML authentication failed.');
        }

        $mapping = $config->attribute_mapping ?? [
            'email' => 'urn:oid:0.9.2342.19200300.100.1.3',
            'name' => 'urn:oid:2.16.840.1.113730.3.1.241',
        ];

        $attributes = $auth->getAttributes();
        $nameId = $auth->getNameId();

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

    private function getAttribute(array $attributes, string $key, string $fallback): string
    {
        if (! empty($key) && isset($attributes[$key])) {
            return is_array($attributes[$key]) ? $attributes[$key][0] : $attributes[$key];
        }

        return $fallback;
    }
}
