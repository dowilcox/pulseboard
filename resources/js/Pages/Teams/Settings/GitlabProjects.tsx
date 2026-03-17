import { Head, router, useForm, usePage } from "@inertiajs/react";
import { useEffect, useState } from "react";
import PageHeader from "@/Components/Layout/PageHeader";
import AuthenticatedLayout from "@/Layouts/AuthenticatedLayout";
import GitlabProjectSearch from "@/Components/Gitlab/GitlabProjectSearch";
import type { GitlabConnection, GitlabProject, PageProps, Team } from "@/types";
import AddIcon from "@mui/icons-material/Add";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import ErrorIcon from "@mui/icons-material/Error";
import LinkIcon from "@mui/icons-material/Link";
import SyncIcon from "@mui/icons-material/Sync";
import InfoIcon from "@mui/icons-material/Info";
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
import FormControl from "@mui/material/FormControl";
import IconButton from "@mui/material/IconButton";
import InputLabel from "@mui/material/InputLabel";
import Link from "@mui/material/Link";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Select from "@mui/material/Select";
import Snackbar from "@mui/material/Snackbar";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";

interface Props extends PageProps {
    team: Team;
    gitlabProjects: (GitlabProject & { connection: GitlabConnection })[];
    connections: GitlabConnection[];
    activeConnections: Pick<GitlabConnection, "id" | "name" | "base_url">[];
}

interface TestResult {
    success: boolean;
    message: string;
}

export default function GitlabProjects({
    team,
    gitlabProjects,
    connections,
    activeConnections,
}: Props) {
    const { flash } = usePage<PageProps>().props;
    const [snackbar, setSnackbar] = useState<{
        open: boolean;
        message: string;
        severity: "success" | "error";
    }>({ open: false, message: "", severity: "success" });

    // Connection state
    const [connDialogOpen, setConnDialogOpen] = useState(false);
    const [editingConnection, setEditingConnection] =
        useState<GitlabConnection | null>(null);
    const [deleteConnId, setDeleteConnId] = useState<string | null>(null);
    const [testResults, setTestResults] = useState<Record<string, TestResult>>(
        {},
    );
    const [testingIds, setTestingIds] = useState<Set<string>>(new Set());

    // Project state
    const [linkDialogOpen, setLinkDialogOpen] = useState(false);
    const [selectedConnectionId, setSelectedConnectionId] = useState<string>(
        activeConnections[0]?.id ?? "",
    );
    const [deleteProjectId, setDeleteProjectId] = useState<string | null>(null);

    useEffect(() => {
        if (!selectedConnectionId && activeConnections.length > 0) {
            setSelectedConnectionId(activeConnections[0].id);
        }
    }, [activeConnections, selectedConnectionId]);

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
        base_url: "",
        api_token: "",
        is_active: true,
    });

    // Connection handlers
    const openCreateConnection = () => {
        setEditingConnection(null);
        connForm.reset();
        connForm.clearErrors();
        setConnDialogOpen(true);
    };

    const openEditConnection = (connection: GitlabConnection) => {
        setEditingConnection(connection);
        connForm.setData({
            name: connection.name,
            base_url: connection.base_url,
            api_token: "",
            is_active: connection.is_active,
        });
        connForm.clearErrors();
        setConnDialogOpen(true);
    };

    const handleConnSubmit = () => {
        if (editingConnection) {
            connForm.put(
                route("teams.gitlab-connections.update", [
                    team.slug,
                    editingConnection.id,
                ]),
                {
                    onSuccess: () => setConnDialogOpen(false),
                },
            );
        } else {
            connForm.post(route("teams.gitlab-connections.store", team.slug), {
                onSuccess: () => setConnDialogOpen(false),
            });
        }
    };

    const handleDeleteConnection = (id: string) => {
        router.delete(
            route("teams.gitlab-connections.destroy", [team.slug, id]),
            {
                onSuccess: () => setDeleteConnId(null),
            },
        );
    };

    const handleTestConnection = async (connection: GitlabConnection) => {
        setTestingIds((prev) => new Set(prev).add(connection.id));
        setTestResults((prev) => {
            const next = { ...prev };
            delete next[connection.id];
            return next;
        });

        try {
            const response = await fetch(
                route("teams.gitlab-connections.test", [
                    team.slug,
                    connection.id,
                ]),
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "X-CSRF-TOKEN":
                            document.querySelector<HTMLMetaElement>(
                                'meta[name="csrf-token"]',
                            )?.content ?? "",
                        Accept: "application/json",
                    },
                },
            );
            const data = await response.json();
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

    // Project handlers
    const handleLinkProject = (project: { id: number }) => {
        router.post(
            route("teams.gitlab-projects.store", team.slug),
            {
                connection_id: selectedConnectionId,
                gitlab_project_id: project.id,
            },
            {
                onSuccess: () => setLinkDialogOpen(false),
            },
        );
    };

    const handleUnlink = (id: string) => {
        router.delete(route("teams.gitlab-projects.destroy", [team.slug, id]), {
            onSuccess: () => setDeleteProjectId(null),
        });
    };

    return (
        <AuthenticatedLayout
            currentTeam={team}
            header={
                <PageHeader
                    title="GitLab Integration"
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
            <Head title={`${team.name} — GitLab`} />

            <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
                {/* Connections */}
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
                                No GitLab connections yet. Add a connection to
                                start linking projects.
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
                                            secondary={connection.base_url}
                                            secondaryTypographyProps={{
                                                variant: "caption",
                                            }}
                                        />
                                    </ListItem>
                                ))}
                            </List>
                        )}
                    </CardContent>
                </Card>

                {/* Linked Projects */}
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
                                Linked Projects ({gitlabProjects.length})
                            </Typography>
                            <Button
                                size="small"
                                startIcon={<AddIcon />}
                                onClick={() => setLinkDialogOpen(true)}
                                disabled={activeConnections.length === 0}
                            >
                                Link Project
                            </Button>
                        </Box>

                        {activeConnections.length === 0 &&
                            connections.length > 0 && (
                                <Alert severity="info" sx={{ mb: 2 }}>
                                    No active connections. Enable a connection
                                    above to link projects.
                                </Alert>
                            )}

                        {gitlabProjects.length === 0 ? (
                            <Typography
                                variant="body2"
                                color="text.secondary"
                                sx={{ py: 2 }}
                            >
                                No GitLab projects linked to this team yet.
                            </Typography>
                        ) : (
                            <List dense disablePadding>
                                {gitlabProjects.map((project) => (
                                    <ListItem
                                        key={project.id}
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
                                            <Tooltip title="Unlink project">
                                                <IconButton
                                                    edge="end"
                                                    size="small"
                                                    color="error"
                                                    onClick={() =>
                                                        setDeleteProjectId(
                                                            project.id,
                                                        )
                                                    }
                                                >
                                                    <DeleteIcon fontSize="small" />
                                                </IconButton>
                                            </Tooltip>
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
                                                    <LinkIcon
                                                        fontSize="small"
                                                        color="action"
                                                    />
                                                    <Link
                                                        href={project.web_url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        underline="hover"
                                                        variant="body2"
                                                        fontWeight={500}
                                                    >
                                                        {
                                                            project.path_with_namespace
                                                        }
                                                    </Link>
                                                    <Chip
                                                        label={
                                                            project.connection
                                                                .name
                                                        }
                                                        size="small"
                                                        variant="outlined"
                                                    />
                                                </Box>
                                            }
                                            secondary={
                                                <Typography
                                                    variant="caption"
                                                    color="text.secondary"
                                                >
                                                    Default branch:{" "}
                                                    {project.default_branch}
                                                    {project.last_synced_at && (
                                                        <>
                                                            {" "}
                                                            · Last synced:{" "}
                                                            {new Date(
                                                                project.last_synced_at,
                                                            ).toLocaleString()}
                                                        </>
                                                    )}
                                                </Typography>
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
                aria-labelledby="gitlab-connection-dialog-title"
            >
                <DialogTitle id="gitlab-connection-dialog-title">
                    {editingConnection
                        ? "Edit Connection"
                        : "Add GitLab Connection"}
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
                            label="Base URL"
                            value={connForm.data.base_url}
                            onChange={(e) =>
                                connForm.setData("base_url", e.target.value)
                            }
                            error={!!connForm.errors.base_url}
                            helperText={
                                connForm.errors.base_url ||
                                "e.g. https://gitlab.example.com"
                            }
                            fullWidth
                            required
                        />
                        <TextField
                            label={
                                editingConnection
                                    ? "API Token (leave blank to keep current)"
                                    : "API Token"
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
                            <AlertTitle>Required token permissions</AlertTitle>
                            Create a <strong>
                                Personal Access Token
                            </strong> or <strong>Project Access Token</strong>{" "}
                            with the <strong>api</strong> scope. This is
                            required for managing webhooks, creating branches,
                            and creating merge requests. The token owner must
                            have <strong>Maintainer</strong> or{" "}
                            <strong>Owner</strong> role on projects you want to
                            link.
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
                aria-labelledby="delete-connection-dialog-title"
            >
                <DialogTitle id="delete-connection-dialog-title">
                    Delete Connection
                </DialogTitle>
                <DialogContent>
                    <Alert severity="warning" sx={{ mt: 1 }}>
                        This will remove the connection and all linked projects.
                        Webhooks will be cleaned up from GitLab.
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

            {/* Link Project Dialog */}
            <Dialog
                open={linkDialogOpen}
                onClose={() => setLinkDialogOpen(false)}
                maxWidth="sm"
                fullWidth
                aria-labelledby="link-project-dialog-title"
            >
                <DialogTitle id="link-project-dialog-title">
                    Link GitLab Project
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
                        {activeConnections.length > 1 && (
                            <FormControl fullWidth>
                                <InputLabel>Connection</InputLabel>
                                <Select
                                    value={selectedConnectionId}
                                    label="Connection"
                                    onChange={(e) =>
                                        setSelectedConnectionId(e.target.value)
                                    }
                                >
                                    {activeConnections.map((conn) => (
                                        <MenuItem key={conn.id} value={conn.id}>
                                            {conn.name} ({conn.base_url})
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        )}
                        {selectedConnectionId && (
                            <GitlabProjectSearch
                                connectionId={selectedConnectionId}
                                teamId={team.slug}
                                onSelect={handleLinkProject}
                            />
                        )}
                    </Box>
                </DialogContent>
                <DialogActions sx={{ px: 3, py: 2 }}>
                    <Button onClick={() => setLinkDialogOpen(false)}>
                        Cancel
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Unlink Project Confirmation */}
            <Dialog
                open={!!deleteProjectId}
                onClose={() => setDeleteProjectId(null)}
                aria-labelledby="unlink-project-dialog-title"
            >
                <DialogTitle id="unlink-project-dialog-title">
                    Unlink Project
                </DialogTitle>
                <DialogContent>
                    <Alert severity="warning" sx={{ mt: 1 }}>
                        This will remove the project link and all associated
                        task GitLab links. The webhook will be removed from
                        GitLab.
                    </Alert>
                </DialogContent>
                <DialogActions sx={{ px: 3, py: 2 }}>
                    <Button onClick={() => setDeleteProjectId(null)}>
                        Cancel
                    </Button>
                    <Button
                        variant="contained"
                        color="error"
                        onClick={() =>
                            deleteProjectId && handleUnlink(deleteProjectId)
                        }
                    >
                        Unlink
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
