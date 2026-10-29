# OpenID Connect (OIDC) Single Sign-On Configuration

PulseBoard supports OpenID Connect SSO next to [SAML2](saml-configuration.md). This guide covers the general setup, recipes for common identity providers, claim mapping, the account-linking rules, logout, and troubleshooting.

## Overview

PulseBoard acts as an OIDC **Relying Party (RP)** and hands authentication off to your **OpenID Provider (OP / IdP)**. Key features:

- **Authorization Code flow with PKCE (S256)**, plus `state` and `nonce` checks
- **Discovery**: point PulseBoard at the issuer URL and it reads `/.well-known/openid-configuration`
- **Full ID token verification**: signature against the provider's JWKS, `iss`, `aud`/`azp`, `exp`/`iat` (60-second leeway), `nonce` and `at_hash`
- **Just-In-Time (JIT) provisioning**: users are created automatically the first time they sign in
- **Claim mapping**: choose which claims fill the email and display name
- **Optional userinfo lookup** to fill in claims the ID token leaves out
- **Optional RP-initiated logout**: signing out of PulseBoard also signs the user out of the IdP
- **Several providers at once**: every active OIDC provider gets its own "Sign in with …" button
- **Admin UI**: everything is configured under **Admin > SSO Configuration** (no `.env` changes needed)

## PulseBoard RP Details

| Field                           | Value                                                                      |
| ------------------------------- | -------------------------------------------------------------------------- |
| **Redirect URI**                | `https://your-domain.com/auth/oidc/<configuration-id>/callback`            |
| **Post-logout redirect URI**    | `https://your-domain.com/login`                                            |
| **Response type**               | `code` (Authorization Code)                                                |
| **PKCE**                        | Required, `S256`                                                           |
| **Default scopes**              | `openid profile email`                                                     |
| **Token endpoint auth**         | `client_secret_basic`, or `client_secret_post` if the IdP only offers that |
| **ID token signing algorithms** | RS256, RS384, RS512, PS256, ES256, ES384, EdDSA (HS\* only if you opt in)  |
| **Application type**            | Confidential web application (has a client secret)                         |

Each OIDC configuration has its own redirect URI. The admin form shows the exact value, with a copy button, **before you save**, so you can register it with the IdP first. Both URIs are built from `APP_URL`, so `APP_URL` must be the public HTTPS address users reach PulseBoard on.

## General Configuration Steps

### 1. Create a client in your IdP

1. Open **Admin > SSO Configuration > Add Provider** in PulseBoard and choose **OpenID Connect**. Copy the **Redirect URI** shown in the form and leave the dialog open (or note the URI).
2. In your IdP, create a **confidential / web** OIDC client with:
    - **Grant type**: Authorization Code
    - **Redirect URI**: the URI you copied, character for character (no trailing slash)
    - **Scopes**: `openid`, `profile`, `email`
    - **Post-logout redirect URI** (optional): `https://your-domain.com/login`
3. Note the **issuer URL**, **client ID** and **client secret**.

### 2. Configure PulseBoard

| Field                                   | Description                                                                                                |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| **Provider Name**                       | Shown to admins (e.g. "Keycloak")                                                                          |
| **Login Button Label**                  | The login page shows "Sign in with _label_". Defaults to the provider name                                 |
| **Issuer URL**                          | The issuer exactly as the IdP publishes it. PulseBoard fetches `<issuer>/.well-known/openid-configuration` |
| **Client ID**                           | From the IdP                                                                                               |
| **Client Secret**                       | From the IdP. Stored encrypted and never shown again; leave it blank when editing to keep the current one  |
| **Scopes**                              | Space-separated. `openid` is always added                                                                  |
| **Email Claim / Name Claim**            | See [Claim Mapping](#claim-mapping)                                                                        |
| **Allowed ID token signing algorithms** | Leave empty to accept every supported asymmetric algorithm (recommended)                                   |
| **Fetch the userinfo endpoint**         | On by default. Fills in claims (such as `email`) that are missing from the ID token                        |
| **Sign out of the identity provider**   | Enables [RP-initiated logout](#logout)                                                                     |
| **Active**                              | Shows the button on the login page                                                                         |

The issuer must use `https://`. Plain `http://` is accepted only when `APP_ENV=local`.

### 3. Test and activate

1. Save the provider, then click the **Test** (sync) icon in its row. PulseBoard fetches the discovery document and JWKS fresh, bypassing the cache, and checks:
    - the discovery `issuer` matches the configured issuer
    - the authorization, token and JWKS endpoints are present and use HTTPS
    - the `code` response type and the `S256` PKCE method are supported (when the IdP advertises them)
    - at least one published signing key matches the allowed algorithms
    - an `end_session_endpoint` exists, if single logout is enabled

    Hover over the result chip to see each check.

2. Toggle **Active**.
3. In a private window, open the login page and click **Sign in with _label_**.

## Claim Mapping

| User field         | Default claim | Fallbacks when the mapped claim is empty                                            |
| ------------------ | ------------- | ----------------------------------------------------------------------------------- |
| **Email**          | `email`       | None. A new user cannot be created without an email address                         |
| **Display name**   | `name`        | `given_name` + `family_name`, then `preferred_username`, `nickname`, then the email |
| **Identity (sub)** | `sub`         | Not configurable                                                                    |

- Claim names are looked up exactly first, so URL-style names such as `https://example.com/claims/email` work. Dotted paths (`address.email`) are tried for nested claims after that.
- If the ID token lacks a claim and **Fetch the userinfo endpoint** is on, PulseBoard calls the userinfo endpoint and uses its values for any missing claims. ID token values always take precedence, and the userinfo `sub` must match the ID token `sub`.
- **`email_verified` only applies to the standard `email` claim.** If you map email to another claim, such as `upn` or `preferred_username`, PulseBoard treats the address as unverified. JIT provisioning still works, but existing accounts will not be linked automatically (see below).
- Admin rights are not derived from IdP groups, the same as with SAML. Grant admin access in **Admin > Users**.

## User Provisioning and Account Linking

Each OIDC user is stored with `auth_provider = oidc` and `auth_provider_id = <first 16 hex chars of sha256(issuer)>:<sub>`. A `sub` is only unique within one issuer, so the issuer is part of the identifier. The same `sub` from a different IdP is a different person.

| Scenario                                                                      | Behavior                                                                                                       |
| ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| User already linked to this issuer + `sub`                                    | Signed in. Name is refreshed; email is updated only if the new one is verified and not used by another account |
| New user (email not in PulseBoard)                                            | Account created via JIT provisioning. `email_verified_at` is set only if the IdP verified the email            |
| Existing account with the same email, `email_verified=true`                   | Account linked to this OIDC identity and signed in                                                             |
| Existing account with the same email, unverified or no `email_verified` claim | **Refused.** The user sees an error and the existing account is left untouched                                 |
| No email claim (and none from userinfo) for a new user                        | Refused                                                                                                        |
| Deactivated user                                                              | Refused before anything is saved                                                                               |
| Bot account with the same email                                               | Refused                                                                                                        |

This is deliberately stricter than SAML, which links to an existing account by email without any verification flag. With OIDC, an unverified email claim can never take over an existing account.

> **Providers without `email_verified`** (notably Microsoft Entra ID) can JIT-provision new users, but they cannot be auto-linked to accounts that already exist. Ask those users to keep signing in with their existing method, or have an administrator remove the duplicate local account before their first SSO login.

### Several providers and local login

- **OIDC**: any number of OIDC providers can be active together, because each one has its own URLs.
- **SAML2**: only one SAML provider can be active at a time, because the SAML endpoints (`/auth/saml/*`) are shared. One SAML and several OIDC providers can be active together.
- **Local passwords**: `php artisan auth:local --disable` turns off password login (it requires at least one active SSO provider). With exactly one active provider, `/login` sends users straight to it. With several, the login page shows one button per provider.

## Logout

When **Sign out of the identity provider on logout** is enabled and the IdP's discovery document has an `end_session_endpoint`, logging out of PulseBoard:

1. ends the PulseBoard session, then
2. redirects the browser to `end_session_endpoint` with `id_token_hint`, `client_id` and `post_logout_redirect_uri=https://your-domain.com/login`.

Register `https://your-domain.com/login` as an allowed post-logout redirect URI in the IdP. If the IdP is unreachable when the user logs out, PulseBoard falls back to a local-only logout. Google does not support RP-initiated logout.

---

## Provider Recipes

In every recipe, **Redirect URI** means the value shown in PulseBoard's form (`https://your-domain.com/auth/oidc/<configuration-id>/callback`).

### Keycloak

1. In your realm, go to **Clients > Create client**, choose **OpenID Connect**, and set a **Client ID** (e.g. `pulseboard`).
2. Turn **Client authentication** on and keep **Standard flow** enabled.
3. Set **Valid redirect URIs** to the Redirect URI and **Valid post logout redirect URIs** to `https://your-domain.com/login`.
4. Optional: under **Advanced > Advanced settings**, set **Proof Key for Code Exchange Code Challenge Method** to `S256` to require PKCE.
5. Copy the secret from the **Credentials** tab.

| PulseBoard field  | Value                                         |
| ----------------- | --------------------------------------------- |
| **Issuer URL**    | `https://keycloak.example.com/realms/<realm>` |
| **Scopes**        | `openid profile email`                        |
| **Email / Name**  | `email` / `name`                              |
| **Single logout** | Supported                                     |

Keycloak sends `email_verified` from each user's **Email verified** flag, so auto-linking only works for users whose email Keycloak has verified.

### Microsoft Entra ID (Azure AD)

1. Go to **Entra admin center > App registrations > New registration**. Choose single tenant, platform **Web**, and enter the Redirect URI.
2. Under **Certificates & secrets**, create a client secret and copy its **Value**. Entra secrets expire, so note the expiry date.
3. Under **Token configuration > Add optional claim > ID**, add `email`. Without it, many accounts send no `email` claim.
4. If you enable single logout, also add `https://your-domain.com/login` under **Authentication**. Entra only redirects to registered URIs after logout.

| PulseBoard field  | Value                                                |
| ----------------- | ---------------------------------------------------- |
| **Issuer URL**    | `https://login.microsoftonline.com/<tenant-id>/v2.0` |
| **Client ID**     | The **Application (client) ID**                      |
| **Scopes**        | `openid profile email`                               |
| **Email / Name**  | `email` / `name`                                     |
| **Single logout** | Supported                                            |

- Use the **tenant-specific** issuer. The `common` and `organizations` endpoints publish a templated issuer (`…/{tenantid}/v2.0`), which fails the issuer check.
- Entra ID tokens carry no `email_verified` claim, so existing accounts are **not** auto-linked (see [account linking](#user-provisioning-and-account-linking)). Mapping email to `preferred_username` (usually the UPN) also counts as unverified.
- Entra's `sub` is unique per application. If you re-create the app registration, users get new identities.

### Google Workspace

1. In **Google Cloud Console > APIs & Services > OAuth consent screen**, choose **Internal**. This limits sign-in to your Workspace organization.
2. Under **Credentials > Create credentials > OAuth client ID**, choose **Web application** and add the Redirect URI under **Authorized redirect URIs**.

| PulseBoard field  | Value                         |
| ----------------- | ----------------------------- |
| **Issuer URL**    | `https://accounts.google.com` |
| **Scopes**        | `openid profile email`        |
| **Email / Name**  | `email` / `name`              |
| **Single logout** | Not supported by Google       |

> **Warning:** With an **External** consent screen, _any_ Google account can sign in, and JIT provisioning will create a PulseBoard account for each one. PulseBoard does not check the `hd` (hosted domain) claim, so keep the consent screen **Internal**.

### Okta

1. Go to **Applications > Create App Integration**, choose **OIDC - OpenID Connect** and then **Web Application**.
2. Set **Sign-in redirect URIs** to the Redirect URI and **Sign-out redirect URIs** to `https://your-domain.com/login`.
3. Keep **Client authentication: Client secret**. Optionally tick **Require PKCE as additional verification**.
4. Assign the users or groups that should have access.

| PulseBoard field  | Value                                                                                            |
| ----------------- | ------------------------------------------------------------------------------------------------ |
| **Issuer URL**    | `https://<org>.okta.com` (org server) or `https://<org>.okta.com/oauth2/default` (custom server) |
| **Scopes**        | `openid profile email`                                                                           |
| **Email / Name**  | `email` / `name`                                                                                 |
| **Single logout** | Supported                                                                                        |

Use the issuer of the authorization server that issues the tokens. The org and `default` servers have different issuers and keys.

### Authentik

1. Go to **Applications > Providers > Create** and choose **OAuth2/OpenID Provider**.
2. Set **Client type** to **Confidential** and add the Redirect URI (matching mode **Strict**).
3. Set **Signing Key** to a certificate (for example the self-signed default). **If you leave it empty, authentik signs ID tokens with HS256**, which PulseBoard rejects by default.
4. Create an **Application** that uses this provider, and note its slug.

| PulseBoard field  | Value                                                                                       |
| ----------------- | ------------------------------------------------------------------------------------------- |
| **Issuer URL**    | `https://authentik.example.com/application/o/<application-slug>/` (with the trailing slash) |
| **Scopes**        | `openid profile email`                                                                      |
| **Email / Name**  | `email` / `name`                                                                            |
| **Single logout** | Supported                                                                                   |

Whether authentik sends `email_verified: true` depends on its `email` scope mapping and version. If existing users cannot link, check the claim in authentik's provider **Preview** tab and adjust the scope mapping if needed.

---

## Security Notes

- `state`, `nonce` and the PKCE verifier are stored in the user's server-side session. They are single-use and expire after 10 minutes. `state` is compared in constant time.
- The callback is a plain `GET`. It is not subject to CSRF middleware; the `state` check binds it to the browser that started the login.
- `alg: none` is never accepted. HMAC (`HS256/384/512`, keyed with the client secret) is accepted only if you add it to **Allowed ID token signing algorithms**. Symmetric (`oct`) keys published in a JWKS are ignored.
- Discovery documents and JWKS are cached for 1 hour. An unknown `kid` (key rotation) triggers one JWKS refetch, at most once per minute. **Test** and editing a provider both clear the cache.
- After sign-in, PulseBoard only redirects to the originally requested page if it is on the same host. Anything else falls back to the dashboard.
- Client secrets and SAML certificates are encrypted at rest and are never sent to the browser. Tokens and secrets are never logged.
- Redirect and callback routes are throttled to 10 requests per minute per IP address.

## Troubleshooting

Failures are logged with a reason (search the application log for `OIDC`). Tokens and secrets are never logged.

| Issue                                                                               | Solution                                                                                                                                                                                                                                    |
| ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **"Issuer mismatch"**                                                               | The issuer field must match the discovery document's `issuer` (only a trailing-slash difference is tolerated). Copy it from `<issuer>/.well-known/openid-configuration`. For Entra, use the tenant ID, not `common`                         |
| **"The ID token has expired" / "not valid yet"**                                    | Clock skew of more than 60 seconds between PulseBoard and the IdP. Make sure both servers sync time with NTP                                                                                                                                |
| **"…did not share an email address"**                                               | The ID token (and userinfo) has no email. Add the `email` scope, release the email claim in the IdP (Entra: the optional `email` claim), turn on **Fetch the userinfo endpoint**, or map **Email Claim** to the claim that carries it       |
| **"An account with this email already exists, but … has not verified the address"** | The IdP did not send `email_verified: true`. See [account linking](#user-provisioning-and-account-linking)                                                                                                                                  |
| **IdP shows "redirect_uri mismatch"**                                               | Register the exact Redirect URI from the PulseBoard form. Check that `APP_URL` is the public HTTPS URL; the URI is built from it                                                                                                            |
| **"Your sign-in attempt is invalid or has expired"**                                | The session cookie didn't survive the round trip, or the login took more than 10 minutes. Check that `SESSION_SAME_SITE` is `lax` (not `strict`), `SESSION_DOMAIN` is correct, and that the user didn't start a second login in another tab |
| **"…algorithm that is not allowed"**                                                | The IdP signs with an algorithm outside the allowed list. For authentik, set a signing key. Only allow `HS256` if the IdP cannot sign asymmetrically                                                                                        |
| **"…audience mismatch" / "authorized party mismatch"**                              | The client ID in PulseBoard doesn't match the one the token was issued for. Copy the client ID again                                                                                                                                        |
| **"No matching signing key was found"**                                             | The JWKS doesn't contain the token's `kid`. Usually a misconfigured authorization server (Okta org vs custom server) or a proxy serving a stale JWKS                                                                                        |
| **"…rejected the authorization code"**                                              | Wrong or expired client secret (Entra secrets expire), or the redirect URI differs from the one registered                                                                                                                                  |
| **"Could not reach…" / "Single sign-on is temporarily unavailable"**                | PulseBoard can't reach the IdP over HTTPS. Check outbound network, proxies and TLS trust from the PulseBoard container                                                                                                                      |
| **Logout doesn't return to PulseBoard**                                             | Register `https://your-domain.com/login` as a post-logout redirect URI (Entra: as a Web redirect URI)                                                                                                                                       |
