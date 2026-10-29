import { useForm } from "@inertiajs/react";
import { useEffect } from "react";
import type { SsoConfiguration, SsoProviderType } from "@/types";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import FormHelperText from "@mui/material/FormHelperText";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Typography from "@mui/material/Typography";
import OidcFields, { type OidcAlgorithms } from "./OidcFields";
import SamlFields, { type SamlServiceProvider } from "./SamlFields";
import {
    DEFAULT_ATTRIBUTE_MAPPING,
    PROVIDER_LABELS,
    emptyForm,
    formFromConfiguration,
    redirectUriFor,
    type SsoFormData,
    type SsoFormErrors,
} from "./ssoForm";

interface SsoProviderDialogProps {
    open: boolean;
    onClose: () => void;
    /** The configuration being edited, or null to create a new one. */
    editing: SsoConfiguration | null;
    /** Server-generated id for a new configuration (fixes its redirect URI). */
    newConfigurationId: string;
    oidcRedirectUriTemplate: string;
    oidcPostLogoutRedirectUri: string;
    samlServiceProvider: SamlServiceProvider;
    oidcAlgorithms: OidcAlgorithms;
}

export default function SsoProviderDialog({
    open,
    onClose,
    editing,
    newConfigurationId,
    oidcRedirectUriTemplate,
    oidcPostLogoutRedirectUri,
    samlServiceProvider,
    oidcAlgorithms,
}: SsoProviderDialogProps) {
    const form = useForm<SsoFormData>(emptyForm("oidc", newConfigurationId));
    const errors = form.errors as SsoFormErrors;
    const { data } = form;

    // Reset whenever the dialog opens for a different target. Deliberately
    // not keyed on newConfigurationId: a failed submit reloads page props
    // (and with them a fresh id), which must not wipe the admin's input.
    // The id captured at open time stays unused until the create succeeds.
    useEffect(() => {
        if (!open) return;
        form.setData(
            editing
                ? formFromConfiguration(editing)
                : emptyForm(data.provider, newConfigurationId),
        );
        form.clearErrors();
    }, [open, editing?.id]);

    const setField = <K extends keyof SsoFormData>(
        key: K,
        value: SsoFormData[K],
    ) => form.setData(key, value as never);

    const switchProvider = (provider: SsoProviderType | null) => {
        if (!provider || provider === data.provider) return;

        // Swap the mapping defaults too, unless the admin already typed some.
        const untouched =
            JSON.stringify(data.attribute_mapping) ===
            JSON.stringify(DEFAULT_ATTRIBUTE_MAPPING[data.provider]);

        form.setData({
            ...data,
            provider,
            attribute_mapping: untouched
                ? { ...DEFAULT_ATTRIBUTE_MAPPING[provider] }
                : data.attribute_mapping,
        });
        form.clearErrors();
    };

    const handleSubmit = () => {
        const options = { preserveScroll: true, onSuccess: () => onClose() };

        if (editing) {
            form.put(route("admin.sso.update", editing.id), options);
        } else {
            form.post(route("admin.sso.store"), options);
        }
    };

    const providerLabel = PROVIDER_LABELS[data.provider];
    const title = editing
        ? `Edit ${providerLabel} Provider`
        : "Add SSO Provider";

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="md"
            fullWidth
            aria-labelledby="sso-provider-dialog-title"
        >
            <DialogTitle id="sso-provider-dialog-title">{title}</DialogTitle>
            <DialogContent>
                <Box
                    sx={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 2,
                        mt: 1,
                    }}
                >
                    {!editing && (
                        <Box>
                            <ToggleButtonGroup
                                value={data.provider}
                                exclusive
                                onChange={(_, value) => switchProvider(value)}
                                size="small"
                                aria-label="Provider type"
                            >
                                <ToggleButton value="oidc">
                                    OpenID Connect
                                </ToggleButton>
                                <ToggleButton value="saml2">SAML2</ToggleButton>
                            </ToggleButtonGroup>
                            {errors.provider && (
                                <FormHelperText error>
                                    {errors.provider}
                                </FormHelperText>
                            )}
                        </Box>
                    )}

                    <TextField
                        label="Provider Name"
                        value={data.name}
                        onChange={(e) => setField("name", e.target.value)}
                        error={!!errors.name}
                        helperText={
                            errors.name ||
                            "Shown to admins, e.g. Okta, Entra ID, Keycloak"
                        }
                        fullWidth
                        required
                    />
                    <TextField
                        label="Login Button Label"
                        value={data.button_label}
                        onChange={(e) =>
                            setField("button_label", e.target.value)
                        }
                        error={!!errors.button_label}
                        helperText={
                            errors.button_label ||
                            `Login page shows "Sign in with ${data.button_label.trim() || data.name.trim() || "…"}". Defaults to the provider name.`
                        }
                        fullWidth
                    />

                    {data.provider === "oidc" ? (
                        <OidcFields
                            data={data}
                            errors={errors}
                            setField={setField}
                            editing={!!editing}
                            hasClientSecret={
                                editing?.provider === "oidc" &&
                                editing.has_client_secret
                            }
                            redirectUri={
                                editing?.provider === "oidc"
                                    ? editing.redirect_uri
                                    : redirectUriFor(
                                          oidcRedirectUriTemplate,
                                          data.id,
                                      )
                            }
                            postLogoutRedirectUri={oidcPostLogoutRedirectUri}
                            algorithms={oidcAlgorithms}
                        />
                    ) : (
                        <SamlFields
                            data={data}
                            errors={errors}
                            setField={setField}
                            editing={!!editing}
                            hasCertificate={
                                editing?.provider === "saml2" &&
                                editing.has_certificate
                            }
                            serviceProvider={samlServiceProvider}
                        />
                    )}

                    <Box>
                        <Box
                            sx={{
                                display: "flex",
                                alignItems: "center",
                                gap: 1,
                            }}
                        >
                            <Switch
                                checked={data.is_active}
                                onChange={(e) =>
                                    setField("is_active", e.target.checked)
                                }
                                inputProps={{ "aria-label": "Active" }}
                            />
                            <Typography>Active</Typography>
                        </Box>
                        {errors.is_active && (
                            <FormHelperText error>
                                {errors.is_active}
                            </FormHelperText>
                        )}
                    </Box>
                </Box>
            </DialogContent>
            <DialogActions sx={{ px: 3, py: 2 }}>
                <Button onClick={onClose}>Cancel</Button>
                <Button
                    variant="contained"
                    onClick={handleSubmit}
                    disabled={form.processing}
                >
                    {editing ? "Update" : "Create"}
                </Button>
            </DialogActions>
        </Dialog>
    );
}
