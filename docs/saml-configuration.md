# SAML2 Single Sign-On Configuration

PulseBoard supports SAML2 SSO for enterprise authentication. This guide covers general SAML configuration and provider-specific setup instructions.

## Overview

PulseBoard acts as a **Service Provider (SP)** and delegates authentication to your **Identity Provider (IdP)**. Key features:

- **Just-In-Time (JIT) provisioning** — users are created automatically on first SAML login
- **Attribute mapping** — configurable mapping from SAML attributes to user fields
- **SP metadata endpoint** — auto-generated metadata for easy IdP registration
- **Admin UI** — all configuration is done through the admin panel (no `.env` changes needed)

## PulseBoard SP Details

| Field                          | Value                                                    |
| ------------------------------ | -------------------------------------------------------- |
| **Entity ID**                  | `https://your-domain.com/auth/saml/metadata`             |
| **ACS URL**                    | `https://your-domain.com/auth/saml/acs`                  |
| **ACS Binding**                | `urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST`         |
| **SSO Binding**                | `urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect`     |
| **NameID Format**              | `urn:oasis:names:tc:SAML:2.0:nameid-format:emailAddress` |
| **Metadata URL**               | `https://your-domain.com/auth/saml/metadata`             |
| **Signed AuthnRequests**       | No                                                       |
| **Signed Assertions Required** | Yes                                                      |

## General Configuration Steps

### 1. Register PulseBoard as a Service Provider in your IdP

Provide your IdP with:

- **SP Entity ID**: `https://your-domain.com/auth/saml/metadata`
- **ACS (Assertion Consumer Service) URL**: `https://your-domain.com/auth/saml/acs`
- **ACS Binding**: HTTP-POST
- **NameID Format**: emailAddress

Most IdPs can import these automatically from the SP metadata URL:

```
https://your-domain.com/auth/saml/metadata
```

> **Note:** The metadata endpoint is only available after you create and activate a configuration in the admin panel.

### 2. Configure attribute mapping

PulseBoard needs two attributes from the SAML assertion:

| User Field | Default SAML Attribute (OID)        | Common Alternatives                                                                   |
| ---------- | ----------------------------------- | ------------------------------------------------------------------------------------- |
| **Email**  | `urn:oid:0.9.2342.19200300.100.1.3` | `email`, `mail`, `http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress` |
| **Name**   | `urn:oid:2.16.840.1.113730.3.1.241` | `displayName`, `cn`, `http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name`     |

Configure your IdP to release these attributes, then set the matching attribute names in the PulseBoard admin panel.

### 3. Configure PulseBoard via Admin Panel

Navigate to **Admin > SSO Configuration** and create a new configuration:

| Field               | Description                                                                                     |
| ------------------- | ----------------------------------------------------------------------------------------------- |
| **Name**            | Display name (e.g., "Corporate SSO")                                                            |
| **Entity ID**       | Your IdP's entity ID (from IdP metadata)                                                        |
| **Login URL**       | IdP's SSO endpoint (HTTP-Redirect binding)                                                      |
| **Logout URL**      | IdP's SLO endpoint (optional)                                                                   |
| **Certificate**     | IdP's X.509 signing certificate (PEM format, without `-----BEGIN/END CERTIFICATE-----` headers) |
| **Metadata URL**    | IdP's metadata URL (optional, for reference)                                                    |
| **Email Attribute** | SAML attribute name for email                                                                   |
| **Name Attribute**  | SAML attribute name for display name                                                            |

### 4. Test and Activate

1. Click **Test** to validate the configuration
2. Toggle **Active** to enable SSO
3. The login page will show a "Sign in with SSO" button

## User Provisioning Behavior

| Scenario                                          | Behavior                                                         |
| ------------------------------------------------- | ---------------------------------------------------------------- |
| New user (email not in system)                    | Account created automatically via JIT provisioning               |
| Existing local user (same email)                  | User prompted to log in with password and link accounts manually |
| Existing SAML user (same email, different NameID) | Provider ID updated automatically                                |
| Deactivated user                                  | Login rejected with deactivation message                         |

---

## WSO2 Identity Server (EEI) Setup

### Prerequisites

- WSO2 Identity Server 5.x or 7.x (or WSO2 Enterprise Integrator with IS features)
- Admin access to the WSO2 Management Console
- PulseBoard instance running with HTTPS

### Step 1: Register PulseBoard as a Service Provider in WSO2

1. Log in to the WSO2 Management Console (`https://wso2-host:9443/carbon`)
2. Navigate to **Main > Identity > Service Providers > Add**
3. Enter a name (e.g., "PulseBoard") and click **Register**

### Step 2: Configure Inbound SAML2 SSO

1. In the Service Provider configuration, expand **Inbound Authentication Configuration**
2. Click **Configure** under **SAML2 Web SSO Configuration**
3. Fill in the fields:

| WSO2 Field                                                 | Value                                                    |
| ---------------------------------------------------------- | -------------------------------------------------------- |
| **Issuer**                                                 | `https://your-pulseboard-domain.com/auth/saml/metadata`  |
| **Assertion Consumer URL**                                 | `https://your-pulseboard-domain.com/auth/saml/acs`       |
| **Default ACS URL**                                        | `https://your-pulseboard-domain.com/auth/saml/acs`       |
| **NameID Format**                                          | `urn:oasis:names:tc:SAML:2.0:nameid-format:emailAddress` |
| **Enable Response Signing**                                | Checked                                                  |
| **Enable Assertion Signing**                               | Checked                                                  |
| **Enable Signature Validation in Authentication Requests** | Unchecked                                                |
| **Enable Attribute Profile**                               | Checked                                                  |
| **Include Attributes in the Response Always**              | Checked                                                  |

4. Click **Register** / **Update**

### Step 3: Configure Claim Mappings

1. In the Service Provider configuration, expand **Claim Configuration**
2. Select **Use Local Claim Dialect**
3. Add the following requested claims:

| Local Claim                           | SAML Attribute         |
| ------------------------------------- | ---------------------- |
| `http://wso2.org/claims/emailaddress` | (maps to email)        |
| `http://wso2.org/claims/displayName`  | (maps to display name) |

4. Set **Subject Claim URI** to `http://wso2.org/claims/emailaddress`

> **Alternative:** If using **Custom Claim Dialect**, map them explicitly and note the URIs to enter in PulseBoard's attribute mapping.

### Step 4: Get WSO2 IdP Details

You need three things from WSO2 for PulseBoard:

**Entity ID:**

- Default: `localhost` (WSO2 IS 5.x) or check **Identity Providers > Resident > Inbound Authentication > SAML2**
- Often: `https://wso2-host:9443/samlsso`

**SSO Login URL:**

```
https://wso2-host:9443/samlsso
```

**IdP Signing Certificate:**

1. Navigate to **Main > Manage > Keystores > List**
2. Click on the primary keystore (usually `wso2carbon.jks`)
3. Export the public certificate for the signing alias (default: `wso2carbon`)
4. Alternatively, download from: **Identity Providers > Resident > Inbound Authentication > SAML2 > Download IdP Certificate**

The certificate should be in PEM format. When entering it in PulseBoard, paste only the Base64 content (without the `-----BEGIN CERTIFICATE-----` and `-----END CERTIFICATE-----` lines).

### Step 5: Configure PulseBoard

In **Admin > SSO Configuration**, create a new configuration:

| Field               | Value                                                     |
| ------------------- | --------------------------------------------------------- |
| **Name**            | WSO2 SSO                                                  |
| **Entity ID**       | `https://wso2-host:9443/samlsso` (or your WSO2 entity ID) |
| **Login URL**       | `https://wso2-host:9443/samlsso`                          |
| **Logout URL**      | `https://wso2-host:9443/samlsso`                          |
| **Certificate**     | (paste WSO2's signing certificate, Base64 only)           |
| **Email Attribute** | `http://wso2.org/claims/emailaddress`                     |
| **Name Attribute**  | `http://wso2.org/claims/displayName`                      |

### Step 6: Test

1. Click **Test** in the PulseBoard admin panel to validate the configuration
2. Toggle **Active** to enable
3. Open PulseBoard's login page in an incognito window
4. Click **Sign in with SSO**
5. You should be redirected to WSO2's login page
6. After authenticating, you should be redirected back to PulseBoard

### WSO2 Troubleshooting

| Issue                        | Solution                                                                                                           |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| "Invalid Issuer" in WSO2     | Ensure the **Issuer** in WSO2 matches PulseBoard's Entity ID exactly: `https://your-domain.com/auth/saml/metadata` |
| Attributes not received      | Enable **Include Attributes in the Response Always** in WSO2 SP config                                             |
| Certificate errors           | Ensure you exported the correct signing certificate and stripped the PEM headers                                   |
| Redirect loop                | Check that the ACS URL in WSO2 matches `https://your-domain.com/auth/saml/acs` exactly (no trailing slash)         |
| NameID is empty              | Set the **Subject Claim URI** to `http://wso2.org/claims/emailaddress` in WSO2's claim config                      |
| Mixed content / HTTPS errors | PulseBoard must be served over HTTPS for SAML to work properly                                                     |

---

## Other Identity Providers

### Okta

| Field               | Where to Find                                                                   |
| ------------------- | ------------------------------------------------------------------------------- |
| **Entity ID**       | Okta app's **Issuer** field (e.g., `http://www.okta.com/exk...`)                |
| **Login URL**       | Okta app's **SSO URL** (e.g., `https://your-org.okta.com/app/.../sso/saml`)     |
| **Certificate**     | Okta app's **Signing Certificate** (download from SAML settings)                |
| **Email Attribute** | `email` or `http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress` |
| **Name Attribute**  | `displayName` or `http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name`   |

### Azure AD (Entra ID)

| Field               | Where to Find                                                        |
| ------------------- | -------------------------------------------------------------------- |
| **Entity ID**       | Azure's **Identifier (Entity ID)** from Enterprise App > SAML config |
| **Login URL**       | Azure's **Login URL** from SAML config                               |
| **Certificate**     | Download **Certificate (Base64)** from Azure's SAML config           |
| **Email Attribute** | `http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress` |
| **Name Attribute**  | `http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name`         |

### Google Workspace

| Field               | Where to Find                                               |
| ------------------- | ----------------------------------------------------------- |
| **Entity ID**       | Google's **Entity ID** from Admin Console > Apps > SAML app |
| **Login URL**       | Google's **SSO URL**                                        |
| **Certificate**     | Download from Google Admin Console SAML app config          |
| **Email Attribute** | `email`                                                     |
| **Name Attribute**  | `name` or `displayName`                                     |

### ADFS

| Field               | Where to Find                                                                             |
| ------------------- | ----------------------------------------------------------------------------------------- |
| **Entity ID**       | ADFS Federation Metadata `entityID` (e.g., `http://adfs.example.com/adfs/services/trust`) |
| **Login URL**       | `https://adfs.example.com/adfs/ls/`                                                       |
| **Certificate**     | Export from ADFS > Service > Certificates > Token-signing                                 |
| **Email Attribute** | `http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress`                      |
| **Name Attribute**  | `http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name`                              |
