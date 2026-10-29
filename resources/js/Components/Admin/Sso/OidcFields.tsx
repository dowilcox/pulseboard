import Alert from "@mui/material/Alert";
import Autocomplete from "@mui/material/Autocomplete";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import FormControlLabel from "@mui/material/FormControlLabel";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import CopyableValue from "./CopyableValue";
import type { SsoFormData, SsoFormErrors } from "./ssoForm";

export interface OidcAlgorithms {
    asymmetric: string[];
    symmetric: string[];
}

interface OidcFieldsProps {
    data: SsoFormData;
    errors: SsoFormErrors;
    setField: <K extends keyof SsoFormData>(
        key: K,
        value: SsoFormData[K],
    ) => void;
    editing: boolean;
    hasClientSecret: boolean;
    redirectUri: string;
    postLogoutRedirectUri: string;
    algorithms: OidcAlgorithms;
}

export default function OidcFields({
    data,
    errors,
    setField,
    editing,
    hasClientSecret,
    redirectUri,
    postLogoutRedirectUri,
    algorithms,
}: OidcFieldsProps) {
    const algorithmOptions = [
        ...algorithms.asymmetric,
        ...algorithms.symmetric,
    ];
    const usesHmac = data.allowed_algorithms.some((alg) =>
        algorithms.symmetric.includes(alg),
    );
    const algorithmError = Object.entries(errors).find(([key]) =>
        key.startsWith("allowed_algorithms"),
    )?.[1];

    return (
        <>
            <Typography variant="subtitle2" sx={{ mt: 1 }}>
                Register PulseBoard with your IdP
            </Typography>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
                <CopyableValue
                    label="Redirect URI"
                    value={redirectUri}
                    helperText={
                        editing
                            ? "Add this exact URI to the client's allowed redirect URIs."
                            : "Add this exact URI to the client's allowed redirect URIs. It is reserved for this provider once you save."
                    }
                />
                {data.end_session_enabled && (
                    <CopyableValue
                        label="Post-logout redirect URI"
                        value={postLogoutRedirectUri}
                        helperText="Register this as an allowed post-logout redirect URI."
                    />
                )}
            </Box>

            <Typography variant="subtitle2" sx={{ mt: 1 }}>
                Identity provider
            </Typography>
            <TextField
                label="Issuer URL"
                value={data.issuer}
                onChange={(e) => setField("issuer", e.target.value)}
                error={!!errors.issuer}
                helperText={
                    errors.issuer ||
                    "PulseBoard loads <issuer>/.well-known/openid-configuration"
                }
                placeholder="https://idp.example.com/realms/acme"
                fullWidth
                required
            />
            <TextField
                label="Client ID"
                value={data.client_id}
                onChange={(e) => setField("client_id", e.target.value)}
                error={!!errors.client_id}
                helperText={errors.client_id}
                fullWidth
                required
            />
            <TextField
                label={
                    editing && hasClientSecret
                        ? "Client Secret (leave blank to keep current)"
                        : "Client Secret"
                }
                type="password"
                autoComplete="new-password"
                value={data.client_secret}
                onChange={(e) => setField("client_secret", e.target.value)}
                error={!!errors.client_secret}
                helperText={
                    errors.client_secret ||
                    "Stored encrypted and never shown again after saving"
                }
                fullWidth
                required={!editing}
            />
            <TextField
                label="Scopes"
                value={data.scopes}
                onChange={(e) => setField("scopes", e.target.value)}
                error={!!errors.scopes}
                helperText={
                    errors.scopes ||
                    'Space-separated. "openid" is always included.'
                }
                fullWidth
            />

            <Typography variant="subtitle2" sx={{ mt: 1 }}>
                Claim Mapping
            </Typography>
            <TextField
                label="Email Claim"
                value={data.attribute_mapping.email}
                onChange={(e) =>
                    setField("attribute_mapping", {
                        ...data.attribute_mapping,
                        email: e.target.value,
                    })
                }
                error={!!errors["attribute_mapping.email"]}
                helperText={
                    errors["attribute_mapping.email"] ||
                    'Default "email". Existing accounts are only linked when the IdP sends email_verified = true for the standard "email" claim.'
                }
                fullWidth
                size="small"
            />
            <TextField
                label="Name Claim"
                value={data.attribute_mapping.name}
                onChange={(e) =>
                    setField("attribute_mapping", {
                        ...data.attribute_mapping,
                        name: e.target.value,
                    })
                }
                error={!!errors["attribute_mapping.name"]}
                helperText={
                    errors["attribute_mapping.name"] ||
                    'Default "name"; falls back to given_name + family_name, then preferred_username'
                }
                fullWidth
                size="small"
            />

            <Typography variant="subtitle2" sx={{ mt: 1 }}>
                Advanced
            </Typography>
            <Autocomplete
                multiple
                options={algorithmOptions}
                value={data.allowed_algorithms}
                onChange={(_, value) => setField("allowed_algorithms", value)}
                renderTags={(value, getTagProps) =>
                    value.map((option, index) => {
                        const { key, ...tagProps } = getTagProps({ index });
                        return (
                            <Chip
                                key={key}
                                label={option}
                                size="small"
                                {...tagProps}
                            />
                        );
                    })
                }
                renderInput={(params) => (
                    <TextField
                        {...params}
                        label="Allowed ID token signing algorithms"
                        size="small"
                        error={!!algorithmError}
                        helperText={
                            algorithmError ||
                            `Leave empty to accept ${algorithms.asymmetric.join(", ")}. HS* must be chosen explicitly; "none" is never accepted.`
                        }
                    />
                )}
            />
            {usesHmac && (
                <Alert severity="warning">
                    HMAC (HS*) tokens are verified with the client secret. Only
                    enable this if your provider cannot sign with an asymmetric
                    key.
                </Alert>
            )}
            <FormControlLabel
                control={
                    <Switch
                        checked={data.fetch_userinfo}
                        onChange={(e) =>
                            setField("fetch_userinfo", e.target.checked)
                        }
                    />
                }
                label="Fetch the userinfo endpoint to fill in missing claims"
            />
            <FormControlLabel
                control={
                    <Switch
                        checked={data.end_session_enabled}
                        onChange={(e) =>
                            setField("end_session_enabled", e.target.checked)
                        }
                    />
                }
                label="Sign out of the identity provider on logout (RP-initiated logout)"
            />
        </>
    );
}
