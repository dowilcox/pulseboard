import { Head, router } from "@inertiajs/react";
import axios from "axios";
import { type ReactElement, useState } from "react";
import LayoutHeader from "@/Components/Layout/LayoutHeader";
import PageHeader from "@/Components/Layout/PageHeader";
import AuthenticatedLayout from "@/Layouts/AuthenticatedLayout";
import AdminNav from "@/Components/Admin/AdminNav";
import type { OidcAlgorithms } from "@/Components/Admin/Sso/OidcFields";
import type { SamlServiceProvider } from "@/Components/Admin/Sso/SamlFields";
import SsoProviderDialog from "@/Components/Admin/Sso/SsoProviderDialog";
import SsoProviderTable, {
    type SsoTestResult,
} from "@/Components/Admin/Sso/SsoProviderTable";
import type { PageProps, SsoConfiguration } from "@/types";
import AddIcon from "@mui/icons-material/Add";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";

interface Props extends PageProps {
    configurations: SsoConfiguration[];
    newConfigurationId: string;
    oidcRedirectUriTemplate: string;
    oidcPostLogoutRedirectUri: string;
    samlServiceProvider: SamlServiceProvider;
    oidcAlgorithms: OidcAlgorithms;
}

export default function SsoConfigurationPage({
    configurations,
    newConfigurationId,
    oidcRedirectUriTemplate,
    oidcPostLogoutRedirectUri,
    samlServiceProvider,
    oidcAlgorithms,
}: Props) {
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editing, setEditing] = useState<SsoConfiguration | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<SsoConfiguration | null>(
        null,
    );
    const [testResults, setTestResults] = useState<
        Record<string, SsoTestResult>
    >({});
    const [testingIds, setTestingIds] = useState<Set<string>>(new Set());

    const openCreateDialog = () => {
        setEditing(null);
        setDialogOpen(true);
    };

    const openEditDialog = (config: SsoConfiguration) => {
        setEditing(config);
        setDialogOpen(true);
    };

    const handleDelete = (config: SsoConfiguration) => {
        router.delete(route("admin.sso.destroy", config.id), {
            onSuccess: () => setDeleteTarget(null),
        });
    };

    const handleTest = async (config: SsoConfiguration) => {
        setTestingIds((prev) => new Set(prev).add(config.id));
        setTestResults((prev) => {
            const next = { ...prev };
            delete next[config.id];
            return next;
        });

        try {
            const { data } = await axios.post<SsoTestResult>(
                route("admin.sso.test", config.id),
            );
            setTestResults((prev) => ({ ...prev, [config.id]: data }));
        } catch (error) {
            // A failed test comes back as 422 with the same result shape.
            const data = axios.isAxiosError<SsoTestResult>(error)
                ? error.response?.data
                : undefined;
            setTestResults((prev) => ({
                ...prev,
                [config.id]: data?.message
                    ? data
                    : { success: false, message: "Network error" },
            }));
        } finally {
            setTestingIds((prev) => {
                const next = new Set(prev);
                next.delete(config.id);
                return next;
            });
        }
    };

    return (
        <>
            <Head title="SSO Configuration" />
            <LayoutHeader>
                <PageHeader
                    title="SSO Configuration"
                    breadcrumbs={[
                        { label: "Admin", href: route("admin.dashboard") },
                    ]}
                />
            </LayoutHeader>

            <Box sx={{ display: "flex" }}>
                <AdminNav />

                <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Box
                        sx={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            gap: 2,
                            mb: 2,
                        }}
                    >
                        <Typography variant="body2" color="text.secondary">
                            Configure OpenID Connect and SAML2 single sign-on
                            providers. Each active provider gets its own button
                            on the login page.
                        </Typography>
                        <Button
                            variant="contained"
                            startIcon={<AddIcon />}
                            onClick={openCreateDialog}
                            sx={{ flexShrink: 0 }}
                        >
                            Add Provider
                        </Button>
                    </Box>

                    {configurations.length === 0 ? (
                        <Paper
                            variant="outlined"
                            sx={{ p: 4, textAlign: "center" }}
                        >
                            <Typography color="text.secondary">
                                No SSO providers configured. Add one to enable
                                enterprise single sign-on.
                            </Typography>
                        </Paper>
                    ) : (
                        <SsoProviderTable
                            configurations={configurations}
                            testResults={testResults}
                            testingIds={testingIds}
                            onTest={handleTest}
                            onEdit={openEditDialog}
                            onDelete={setDeleteTarget}
                        />
                    )}
                </Box>
            </Box>

            <SsoProviderDialog
                open={dialogOpen}
                onClose={() => setDialogOpen(false)}
                editing={editing}
                newConfigurationId={newConfigurationId}
                oidcRedirectUriTemplate={oidcRedirectUriTemplate}
                oidcPostLogoutRedirectUri={oidcPostLogoutRedirectUri}
                samlServiceProvider={samlServiceProvider}
                oidcAlgorithms={oidcAlgorithms}
            />

            <Dialog
                open={!!deleteTarget}
                onClose={() => setDeleteTarget(null)}
                aria-labelledby="delete-sso-dialog-title"
            >
                <DialogTitle id="delete-sso-dialog-title">
                    Delete SSO Provider
                </DialogTitle>
                <DialogContent>
                    <Alert severity="warning" sx={{ mt: 1 }}>
                        This will remove {deleteTarget?.name ?? "the provider"}.
                        Users authenticated via this provider will need to reset
                        their password or use another authentication method.
                    </Alert>
                </DialogContent>
                <DialogActions sx={{ px: 3, py: 2 }}>
                    <Button onClick={() => setDeleteTarget(null)}>
                        Cancel
                    </Button>
                    <Button
                        variant="contained"
                        color="error"
                        onClick={() =>
                            deleteTarget && handleDelete(deleteTarget)
                        }
                    >
                        Delete
                    </Button>
                </DialogActions>
            </Dialog>
        </>
    );
}

SsoConfigurationPage.layout = (page: ReactElement) => (
    <AuthenticatedLayout>{page}</AuthenticatedLayout>
);
