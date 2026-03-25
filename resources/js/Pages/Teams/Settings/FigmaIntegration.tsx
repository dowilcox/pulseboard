import { Head, router, useForm, usePage } from "@inertiajs/react";
import axios from "axios";
import { useEffect, useState } from "react";
import PageHeader from "@/Components/Layout/PageHeader";
import AuthenticatedLayout from "@/Layouts/AuthenticatedLayout";
import type { FigmaConnection, PageProps, Team } from "@/types";
import AddIcon from "@mui/icons-material/Add";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import ErrorIcon from "@mui/icons-material/Error";
import InfoIcon from "@mui/icons-material/Info";
import SyncIcon from "@mui/icons-material/Sync";
import Alert from "@mui/material/Alert";
import AlertTitle from "@mui/material/AlertTitle";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import Snackbar from "@mui/material/Snackbar";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";

interface Props extends PageProps {
    team: Team;
    connections: FigmaConnection[];
}

interface TestResult {
    success: boolean;
    message: string;
}

export default function FigmaIntegration({ team, connections }: Props) {
    const { flash } = usePage<PageProps>().props;
    const [snackbar, setSnackbar] = useState<{
        open: boolean;
        message: string;
        severity: "success" | "error";
    }>({ open: false, message: "", severity: "success" });

    const [connDialogOpen, setConnDialogOpen] = useState(false);
    const [editingConnection, setEditingConnection] =
        useState<FigmaConnection | null>(null);
    const [deleteConnId, setDeleteConnId] = useState<string | null>(null);
    const [testResults, setTestResults] = useState<Record<string, TestResult>>(
        {},
    );
    const [testingIds, setTestingIds] = useState<Set<string>>(new Set());

    useEffect(() => {
        if (flash?.success) {
            setSnackbar({
                open: true,
                message: flash.success,
                severity: "success",
            });
        } else if (flash?.error) {
            setSnackbar({
                open: true,
                message: flash.error,
                severity: "error",
            });
        }
    }, [flash?.success, flash?.error]);

    const connForm = useForm({
        name: "",
        api_token: "",
        is_active: true,
    });

    const openCreateConnection = () => {
        setEditingConnection(null);
        connForm.reset();
        connForm.clearErrors();
        setConnDialogOpen(true);
    };

    const openEditConnection = (connection: FigmaConnection) => {
        setEditingConnection(connection);
        connForm.setData({
            name: connection.name,
            api_token: "",
            is_active: connection.is_active,
        });
        connForm.clearErrors();
        setConnDialogOpen(true);
    };

    const handleConnSubmit = () => {
        if (editingConnection) {
            connForm.put(
                route("teams.figma-connections.update", [
                    team.slug,
                    editingConnection.id,
                ]),
                {
                    onSuccess: () => setConnDialogOpen(false),
                },
            );
        } else {
            connForm.post(route("teams.figma-connections.store", team.slug), {
                onSuccess: () => setConnDialogOpen(false),
            });
        }
    };

    const handleDeleteConnection = (id: string) => {
        router.delete(
            route("teams.figma-connections.destroy", [team.slug, id]),
            {
                onSuccess: () => setDeleteConnId(null),
            },
        );
    };

    const handleTestConnection = async (connection: FigmaConnection) => {
        setTestingIds((prev) => new Set(prev).add(connection.id));
        setTestResults((prev) => {
            const next = { ...prev };
            delete next[connection.id];
            return next;
        });

        try {
            const { data } = await axios.post(
                route("teams.figma-connections.test", [
                    team.slug,
                    connection.id,
                ]),
            );
            setTestResults((prev) => ({ ...prev, [connection.id]: data }));
        } catch {
            setTestResults((prev) => ({
                ...prev,
                [connection.id]: { success: false, message: "Network error" },
            }));
        } finally {
            setTestingIds((prev) => {
                const next = new Set(prev);
                next.delete(connection.id);
                return next;
            });
        }
    };

    return (
        <AuthenticatedLayout
            currentTeam={team}
            header={
                <PageHeader
                    title="Figma Integration"
                    breadcrumbs={[
                        { label: "Teams", href: route("teams.index") },
                        {
                            label: team.name,
                            href: route("teams.show", team.slug),
                        },
                    ]}
                />
            }
        >
            <Head title={`${team.name} — Figma`} />

            <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
                <Card variant="outlined">
                    <CardContent>
                        <Box
                            sx={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                mb: 2,
                            }}
                        >
                            <Typography variant="subtitle1" fontWeight={600}>
                                Connections ({connections.length})
                            </Typography>
                            <Button
                                size="small"
                                startIcon={<AddIcon />}
                                onClick={openCreateConnection}
                            >
                                Add Connection
                            </Button>
                        </Box>

                        {connections.length === 0 ? (
                            <Typography
                                variant="body2"
                                color="text.secondary"
                                sx={{ py: 2 }}
                            >
                                No Figma connections yet. Add a connection to
                                start linking designs to tasks.
                            </Typography>
                        ) : (
                            <List dense disablePadding>
                                {connections.map((connection) => (
                                    <ListItem
                                        key={connection.id}
                                        disableGutters
                                        sx={{
                                            py: 0.75,
                                            px: 1,
                                            borderRadius: 1,
                                            "&:hover": {
                                                bgcolor: "action.hover",
                                            },
                                        }}
                                        secondaryAction={
                                            <Box
                                                sx={{
                                                    display: "flex",
                                                    alignItems: "center",
                                                    gap: 0.5,
                                                }}
                                            >
                                                <Tooltip title="Test connection">
                                                    <span>
                                                        <IconButton
                                                            size="small"
                                                            onClick={() =>
                                                                handleTestConnection(
                                                                    connection,
                                                                )
                                                            }
                                                            disabled={testingIds.has(
                                                                connection.id,
                                                            )}
                                                        >
                                                            {testingIds.has(
                                                                connection.id,
                                                            ) ? (
                                                                <CircularProgress
                                                                    size={18}
                                                                />
                                                            ) : (
                                                                <SyncIcon fontSize="small" />
                                                            )}
                                                        </IconButton>
                                                    </span>
                                                </Tooltip>
                                                <Tooltip title="Edit">
                                                    <IconButton
                                                        size="small"
                                                        onClick={() =>
                                                            openEditConnection(
                                                                connection,
                                                            )
                                                        }
                                                    >
                                                        <EditIcon fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>
                                                <Tooltip title="Delete">
                                                    <IconButton
                                                        size="small"
                                                        color="error"
                                                        onClick={() =>
                                                            setDeleteConnId(
                                                                connection.id,
                                                            )
                                                        }
                                                    >
                                                        <DeleteIcon fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>
                                            </Box>
                                        }
                                    >
                                        <ListItemText
                                            primary={
                                                <Box
                                                    sx={{
                                                        display: "flex",
                                                        alignItems: "center",
                                                        gap: 1,
                                                    }}
                                                >
                                                    <Typography
                                                        variant="body2"
                                                        fontWeight={500}
                                                    >
                                                        {connection.name}
                                                    </Typography>
                                                    <Chip
                                                        label={
                                                            connection.is_active
                                                                ? "Active"
                                                                : "Inactive"
                                                        }
                                                        color={
                                                            connection.is_active
                                                                ? "success"
                                                                : "default"
                                                        }
                                                        size="small"
                                                        variant="outlined"
                                                    />
                                                    {testResults[
                                                        connection.id
                                                    ] && (
                                                        <Chip
                                                            icon={
                                                                testResults[
                                                                    connection
                                                                        .id
                                                                ].success ? (
                                                                    <CheckCircleIcon />
                                                                ) : (
                                                                    <ErrorIcon />
                                                                )
                                                            }
                                                            label={
                                                                testResults[
                                                                    connection
                                                                        .id
                                                                ].message
                                                            }
                                                            color={
                                                                testResults[
                                                                    connection
                                                                        .id
                                                                ].success
                                                                    ? "success"
                                                                    : "error"
                                                            }
                                                            size="small"
                                                            variant="outlined"
                                                        />
                                                    )}
                                                </Box>
                                            }
                                        />
                                    </ListItem>
                                ))}
                            </List>
                        )}
                    </CardContent>
                </Card>
            </Box>

            {/* Create/Edit Connection Dialog */}
            <Dialog
                open={connDialogOpen}
                onClose={() => setConnDialogOpen(false)}
                maxWidth="sm"
                fullWidth
                aria-labelledby="figma-connection-dialog-title"
            >
                <DialogTitle id="figma-connection-dialog-title">
                    {editingConnection
                        ? "Edit Connection"
                        : "Add Figma Connection"}
                </DialogTitle>
                <DialogContent>
                    <Box
                        sx={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 2,
                            mt: 1,
                        }}
                    >
                        <TextField
                            label="Name"
                            value={connForm.data.name}
                            onChange={(e) =>
                                connForm.setData("name", e.target.value)
                            }
                            error={!!connForm.errors.name}
                            helperText={connForm.errors.name}
                            fullWidth
                            required
                        />
                        <TextField
                            label={
                                editingConnection
                                    ? "Personal Access Token (leave blank to keep current)"
                                    : "Personal Access Token"
                            }
                            value={connForm.data.api_token}
                            onChange={(e) =>
                                connForm.setData("api_token", e.target.value)
                            }
                            error={!!connForm.errors.api_token}
                            helperText={connForm.errors.api_token}
                            type="password"
                            fullWidth
                            required={!editingConnection}
                        />
                        <Alert severity="info" icon={<InfoIcon />}>
                            <AlertTitle>How to create a Figma token</AlertTitle>
                            Go to{" "}
                            <strong>
                                Figma Settings &rarr; Security &rarr; Personal
                                access tokens
                            </strong>{" "}
                            and generate a new token with the following scopes:
                            <Box
                                component="ul"
                                sx={{ mt: 0.5, mb: 0, pl: 2.5 }}
                            >
                                <li>
                                    <strong>File metadata (Read)</strong> — file
                                    names, thumbnails, and last modified dates
                                </li>
                                <li>
                                    <strong>File content (Read)</strong> — node
                                    previews, frame names, and rendered
                                    thumbnails
                                </li>
                            </Box>
                            <Typography
                                variant="caption"
                                sx={{ display: "block", mt: 0.5 }}
                            >
                                Tokens expire after 90 days. Both scopes are
                                recommended. Without File content, links will
                                still work but won't show design previews or
                                node details.
                            </Typography>
                        </Alert>
                        <Box
                            sx={{
                                display: "flex",
                                alignItems: "center",
                                gap: 1,
                            }}
                        >
                            <Switch
                                checked={connForm.data.is_active}
                                onChange={(e) =>
                                    connForm.setData(
                                        "is_active",
                                        e.target.checked,
                                    )
                                }
                            />
                            <Typography>Active</Typography>
                        </Box>
                    </Box>
                </DialogContent>
                <DialogActions sx={{ px: 3, py: 2 }}>
                    <Button onClick={() => setConnDialogOpen(false)}>
                        Cancel
                    </Button>
                    <Button
                        variant="contained"
                        onClick={handleConnSubmit}
                        disabled={connForm.processing}
                    >
                        {editingConnection ? "Update" : "Create"}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Delete Connection Confirmation */}
            <Dialog
                open={!!deleteConnId}
                onClose={() => setDeleteConnId(null)}
                aria-labelledby="delete-figma-connection-dialog-title"
            >
                <DialogTitle id="delete-figma-connection-dialog-title">
                    Delete Connection
                </DialogTitle>
                <DialogContent>
                    <Alert severity="warning" sx={{ mt: 1 }}>
                        This will remove the connection and all Figma links on
                        tasks that use it.
                    </Alert>
                </DialogContent>
                <DialogActions sx={{ px: 3, py: 2 }}>
                    <Button onClick={() => setDeleteConnId(null)}>
                        Cancel
                    </Button>
                    <Button
                        variant="contained"
                        color="error"
                        onClick={() =>
                            deleteConnId && handleDeleteConnection(deleteConnId)
                        }
                    >
                        Delete
                    </Button>
                </DialogActions>
            </Dialog>

            <Snackbar
                open={snackbar.open}
                autoHideDuration={4000}
                onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
                anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
            >
                <Alert
                    onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
                    severity={snackbar.severity}
                    variant="filled"
                    role="status"
                    sx={{ width: "100%" }}
                >
                    {snackbar.message}
                </Alert>
            </Snackbar>
        </AuthenticatedLayout>
    );
}
