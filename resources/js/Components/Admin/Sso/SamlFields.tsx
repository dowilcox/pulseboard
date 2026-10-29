import Box from "@mui/material/Box";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import CopyableValue from "./CopyableValue";
import type { SsoFormData, SsoFormErrors } from "./ssoForm";

export interface SamlServiceProvider {
    entity_id: string;
    acs_url: string;
}

interface SamlFieldsProps {
    data: SsoFormData;
    errors: SsoFormErrors;
    setField: <K extends keyof SsoFormData>(
        key: K,
        value: SsoFormData[K],
    ) => void;
    editing: boolean;
    hasCertificate: boolean;
    serviceProvider: SamlServiceProvider;
}

export default function SamlFields({
    data,
    errors,
    setField,
    editing,
    hasCertificate,
    serviceProvider,
}: SamlFieldsProps) {
    return (
        <>
            <Typography variant="subtitle2" sx={{ mt: 1 }}>
                Register PulseBoard with your IdP
            </Typography>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
                <CopyableValue
                    label="SP Entity ID / Metadata URL"
                    value={serviceProvider.entity_id}
                />
                <CopyableValue
                    label="ACS URL (HTTP-POST)"
                    value={serviceProvider.acs_url}
                />
            </Box>

            <Typography variant="subtitle2" sx={{ mt: 1 }}>
                Identity provider
            </Typography>
            <TextField
                label="IdP Entity ID"
                value={data.entity_id}
                onChange={(e) => setField("entity_id", e.target.value)}
                error={!!errors.entity_id}
                helperText={errors.entity_id}
                fullWidth
                required
            />
            <TextField
                label="SSO Login URL"
                value={data.login_url}
                onChange={(e) => setField("login_url", e.target.value)}
                error={!!errors.login_url}
                helperText={errors.login_url}
                fullWidth
                required
            />
            <TextField
                label="SSO Logout URL"
                value={data.logout_url}
                onChange={(e) => setField("logout_url", e.target.value)}
                error={!!errors.logout_url}
                helperText={errors.logout_url || "Optional"}
                fullWidth
            />
            <TextField
                label={
                    editing && hasCertificate
                        ? "IdP Certificate (leave blank to keep current)"
                        : "IdP Certificate"
                }
                value={data.certificate}
                onChange={(e) => setField("certificate", e.target.value)}
                error={!!errors.certificate}
                helperText={
                    errors.certificate ||
                    "Paste the X.509 certificate from your IdP"
                }
                multiline
                rows={4}
                fullWidth
                required={!editing}
            />
            <TextField
                label="Metadata URL"
                value={data.metadata_url}
                onChange={(e) => setField("metadata_url", e.target.value)}
                error={!!errors.metadata_url}
                helperText={errors.metadata_url || "Optional IdP metadata URL"}
                fullWidth
            />

            <Typography variant="subtitle2" sx={{ mt: 1 }}>
                Attribute Mapping
            </Typography>
            <TextField
                label="Email Attribute"
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
                    "SAML attribute for user email"
                }
                fullWidth
                size="small"
            />
            <TextField
                label="Name Attribute"
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
                    "SAML attribute for user display name"
                }
                fullWidth
                size="small"
            />
        </>
    );
}
