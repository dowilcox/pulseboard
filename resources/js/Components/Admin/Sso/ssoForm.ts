import type { SsoConfiguration, SsoProviderType } from "@/types";

/**
 * One flat form for both provider types. The backend validates and keeps
 * only the fields that belong to the chosen provider.
 */
export interface SsoFormData {
    id: string;
    provider: SsoProviderType;
    name: string;
    button_label: string;
    is_active: boolean;
    attribute_mapping: {
        email: string;
        name: string;
    };
    // SAML2
    entity_id: string;
    login_url: string;
    logout_url: string;
    certificate: string;
    metadata_url: string;
    // OIDC
    issuer: string;
    client_id: string;
    client_secret: string;
    scopes: string;
    allowed_algorithms: string[];
    fetch_userinfo: boolean;
    end_session_enabled: boolean;
}

/** Field-level errors, including nested keys like `attribute_mapping.email`. */
export type SsoFormErrors = Partial<Record<string, string>>;

export const DEFAULT_ATTRIBUTE_MAPPING: Record<
    SsoProviderType,
    SsoFormData["attribute_mapping"]
> = {
    saml2: {
        email: "urn:oid:0.9.2342.19200300.100.1.3",
        name: "urn:oid:2.16.840.1.113730.3.1.241",
    },
    oidc: {
        email: "email",
        name: "name",
    },
};

export const DEFAULT_OIDC_SCOPES = "openid profile email";

export const PROVIDER_LABELS: Record<SsoProviderType, string> = {
    saml2: "SAML2",
    oidc: "OpenID Connect",
};

export function emptyForm(provider: SsoProviderType, id: string): SsoFormData {
    return {
        id,
        provider,
        name: "",
        button_label: "",
        is_active: false,
        attribute_mapping: { ...DEFAULT_ATTRIBUTE_MAPPING[provider] },
        entity_id: "",
        login_url: "",
        logout_url: "",
        certificate: "",
        metadata_url: "",
        issuer: "",
        client_id: "",
        client_secret: "",
        scopes: DEFAULT_OIDC_SCOPES,
        allowed_algorithms: [],
        fetch_userinfo: true,
        end_session_enabled: false,
    };
}

/** Form state for editing. Secrets always start blank ("keep current"). */
export function formFromConfiguration(config: SsoConfiguration): SsoFormData {
    const base = emptyForm(config.provider, config.id);
    const mapping = {
        email: config.attribute_mapping?.email ?? "",
        name: config.attribute_mapping?.name ?? "",
    };

    if (config.provider === "oidc") {
        return {
            ...base,
            name: config.name,
            button_label: config.button_label ?? "",
            is_active: config.is_active,
            attribute_mapping: mapping,
            issuer: config.issuer,
            client_id: config.client_id,
            scopes: config.scopes || DEFAULT_OIDC_SCOPES,
            allowed_algorithms: config.allowed_algorithms ?? [],
            fetch_userinfo: config.fetch_userinfo,
            end_session_enabled: config.end_session_enabled,
        };
    }

    return {
        ...base,
        name: config.name,
        button_label: config.button_label ?? "",
        is_active: config.is_active,
        attribute_mapping: mapping,
        entity_id: config.entity_id,
        login_url: config.login_url,
        logout_url: config.logout_url ?? "",
        metadata_url: config.metadata_url ?? "",
    };
}

/** Build the redirect URI from the server-provided template. */
export function redirectUriFor(template: string, id: string): string {
    return template.replace("{id}", id);
}
