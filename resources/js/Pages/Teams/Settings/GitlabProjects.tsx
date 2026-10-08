import ConfirmDialog from "@/Components/Common/ConfirmDialog";
import GitlabProjectSearch from "@/Components/Gitlab/GitlabProjectSearch";
import type { GitlabConnection, GitlabProject, Team } from "@/types";
import { router, useForm } from "@inertiajs/react";
import AddIcon from "@mui/icons-material/Add";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import EditIcon from "@mui/icons-material/Edit";
import ErrorIcon from "@mui/icons-material/Error";
import InfoIcon from "@mui/icons-material/Info";
import LinkIcon from "@mui/icons-material/Link";
import SyncIcon from "@mui/icons-material/Sync";
import Alert from "@mui/material/Alert";
import AlertTitle from "@mui/material/AlertTitle";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import FormControl from "@mui/material/FormControl";
import FormControlLabel from "@mui/material/FormControlLabel";
import IconButton from "@mui/material/IconButton";
import InputLabel from "@mui/material/InputLabel";
import MuiLink from "@mui/material/Link";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import axios from "axios";
import { useEffect, useState } from "react";
import SectionCard from "./SectionCard";

export interface GitlabSettings {
    projects: (GitlabProject & { connection: GitlabConnection })[];
    connections: GitlabConnection[];
    activeConnections: Pick<GitlabConnection, "id" | "name" | "base_url">[];
}

interface Props extends GitlabSettings {
    team: Team;
}

interface TestResult {
    success: boolean;
    message: string;
}

const ROW_SX = {
    display: "flex",
    alignItems: "center",
    flexWrap: "wrap",
    columnGap: 2,
    rowGap: 1,
    py: 1.25,
    borderTop: 1,
    borderColor: "divider",
    "&:first-of-type": { borderTop: 0 },
} as const;

function SubsectionHeader({
    title,
    action,
}: {
    title: string;
    action?: React.ReactNode;
}) {
    return (
        <Box
            sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: 1,
                mb: 1,
            }}
        >
            <Typography component="h3" variant="subtitle2" fontWeight={700}>
                {title}
            </Typography>
            {action}
        </Box>
    );
}

/** GitLab connections and linked projects (Integrations tab of team settings). */
export default function GitlabProjects({
    team,
    projects,
    connections,
    activeConnections,
}: Props) {
    // Connection state
    const [connDialogOpen, setConnDialogOpen] = useState(false);
    const [editingConnection, setEditingConnection] =
        useState<GitlabConnection | null>(null);
    const [deleteConnection, setDeleteConnection] =
        useState<GitlabConnection | null>(null);
    const [testResults, setTestResults] = useState<Record<string, TestResult>>(
        {},
    );
    const [testingIds, setTestingIds] = useState<Set<string>>(new Set());

    // Project state
    const [linkDialogOpen, setLinkDialogOpen] = useState(false);
    const [selectedConnectionId, setSelectedConnectionId] = useState<string>(
        activeConnections[0]?.id ?? "",
    );
    const [unlinkProject, setUnlinkProject] = useState<GitlabProject | null>(
        null,
    );

    useEffect(() => {
        if (
            !activeConnections.some((c) => c.id === selectedConnectionId) &&
            activeConnections.length > 0
        ) {
            setSelectedConnectionId(activeConnections[0].id);
        }
    }, [activeConnections, selectedConnectionId]);

    const connForm = useForm({
        name: "",
        base_url: "",
        api_token: "",
        is_active: true,
    });

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

    const handleConnSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const options = {
            preserveScroll: true,
            onSuccess: () => setConnDialogOpen(false),
        };
        if (editingConnection) {
            connForm.put(
                route("teams.gitlab-connections.update", [
                    team.slug,
                    editingConnection.id,
                ]),
                options,
            );
        } else {
            connForm.post(
                route("teams.gitlab-connections.store", team.slug),
                options,
            );
        }
    };

    const handleDeleteConnection = () => {
        if (!deleteConnection) return;
        router.delete(
            route("teams.gitlab-connections.destroy", [
                team.slug,
                deleteConnection.id,
            ]),
            {
                preserveScroll: true,
                onSuccess: () => setDeleteConnection(null),
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
            const { data } = await axios.post(
                route("teams.gitlab-connections.test", [
                    team.slug,
                    connection.id,
                ]),
            );
            setTestResults((prev) => ({ ...prev, [connection.id]: data }));
        } catch (err) {
            const message =
                axios.isAxiosError(err) && err.response?.data?.message
                    ? String(err.response.data.message)
                    : "Network error";
            setTestResults((prev) => ({
                ...prev,
                [connection.id]: { success: false, message },
            }));
        } finally {
            setTestingIds((prev) => {
                const next = new Set(prev);
                next.delete(connection.id);
                return next;
            });
        }
    };

    const handleLinkProject = (project: { id: number }) => {
        router.post(
            route("teams.gitlab-projects.store", team.slug),
            {
                connection_id: selectedConnectionId,
                gitlab_project_id: project.id,
            },
            {
                preserveScroll: true,
                onSuccess: () => setLinkDialogOpen(false),
            },
        );
    };

    const handleUnlink = () => {
        if (!unlinkProject) return;
        router.delete(
            route("teams.gitlab-projects.destroy", [
                team.slug,
                unlinkProject.id,
            ]),
            {
                preserveScroll: true,
                onSuccess: () => setUnlinkProject(null),
            },
        );
    };

    return (
        <>
            <SectionCard
                title="GitLab"
                description="Connect a GitLab instance and link projects so tasks can create branches and merge requests and show their status."
            >
                <Box sx={{ mb: 3 }}>
                    <SubsectionHeader
                        title={`Connections (${connections.length})`}
                        action={
                            <Button
                                size="small"
                                startIcon={<AddIcon />}
                                onClick={openCreateConnection}
                            >
                                Add connection
                            </Button>
                        }
                    />
                    {connections.length === 0 ? (
                        <Typography variant="body2" color="text.secondary">
                            No GitLab connections yet. Add a connection to start
                            linking projects.
                        </Typography>
                    ) : (
                        <Box
                            component="ul"
                            sx={{ listStyle: "none", m: 0, p: 0 }}
                        >
                            {connections.map((connection) => {
                                const result = testResults[connection.id];
                                const testing = testingIds.has(connection.id);
                                return (
                                    <Box
                                        component="li"
                                        key={connection.id}
                                        sx={ROW_SX}
                                    >
                                        <Box
                                            sx={{
                                                minWidth: 0,
                                                flex: "1 1 220px",
                                            }}
                                        >
                                            <Box
                                                sx={{
                                                    display: "flex",
                                                    alignItems: "center",
                                                    gap: 1,
                                                    flexWrap: "wrap",
                                                }}
                                            >
                                                <Typography
                                                    variant="body2"
                                                    fontWeight={600}
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
                                            </Box>
                                            <Typography
                                                variant="caption"
                                                color="text.secondary"
                                                component="div"
                                                sx={{ wordBreak: "break-all" }}
                                            >
                                                {connection.base_url}
                                            </Typography>
                                            {result && (
                                                <Chip
                                                    icon={
                                                        result.success ? (
                                                            <CheckCircleIcon />
                                                        ) : (
                                                            <ErrorIcon />
                                                        )
                                                    }
                                                    label={result.message}
                                                    color={
                                                        result.success
                                                            ? "success"
                                                            : "error"
                                                    }
                                                    size="small"
                                                    variant="outlined"
                                                    sx={{
                                                        mt: 0.75,
                                                        maxWidth: "100%",
                                                    }}
                                                />
                                            )}
                                        </Box>
                                        <Box
                                            sx={{
                                                display: "flex",
                                                gap: 0.5,
                                                ml: "auto",
                                            }}
                                        >
                                            <Tooltip title="Test connection">
                                                <span>
                                                    <IconButton
                                                        size="small"
                                                        aria-label={`Test connection ${connection.name}`}
                                                        onClick={() =>
                                                            handleTestConnection(
                                                                connection,
                                                            )
                                                        }
                                                        disabled={testing}
                                                    >
                                                        {testing ? (
                                                            <CircularProgress
                                                                size={18}
                                                            />
                                                        ) : (
                                                            <SyncIcon fontSize="small" />
                                                        )}
                                                    </IconButton>
                                                </span>
                                            </Tooltip>
                                            <Tooltip title="Edit connection">
                                                <IconButton
                                                    size="small"
                                                    aria-label={`Edit connection ${connection.name}`}
                                                    onClick={() =>
                                                        openEditConnection(
                                                            connection,
                                                        )
                                                    }
                                                >
                                                    <EditIcon fontSize="small" />
                                                </IconButton>
                                            </Tooltip>
                                            <Tooltip title="Delete connection">
                                                <IconButton
                                                    size="small"
                                                    color="error"
                                                    aria-label={`Delete connection ${connection.name}`}
                                                    onClick={() =>
                                                        setDeleteConnection(
                                                            connection,
                                                        )
                                                    }
                                                >
                                                    <DeleteOutlineIcon fontSize="small" />
                                                </IconButton>
                                            </Tooltip>
                                        </Box>
                                    </Box>
                                );
                            })}
                        </Box>
                    )}
                </Box>

                <Box>
                    <SubsectionHeader
                        title={`Linked projects (${projects.length})`}
                        action={
                            <Button
                                size="small"
                                startIcon={<AddIcon />}
                                onClick={() => setLinkDialogOpen(true)}
                                disabled={activeConnections.length === 0}
                            >
                                Link project
                            </Button>
                        }
                    />
                    {activeConnections.length === 0 &&
                        connections.length > 0 && (
                            <Alert severity="info" sx={{ mb: 2 }}>
                                No active connections. Enable a connection above
                                to link projects.
                            </Alert>
                        )}
                    {projects.length === 0 ? (
                        <Typography variant="body2" color="text.secondary">
                            No GitLab projects linked to this team yet.
                        </Typography>
                    ) : (
                        <Box
                            component="ul"
                            sx={{ listStyle: "none", m: 0, p: 0 }}
                        >
                            {projects.map((project) => (
                                <Box
                                    component="li"
                                    key={project.id}
                                    sx={ROW_SX}
                                >
                                    <Box
                                        sx={{
                                            minWidth: 0,
                                            flex: "1 1 220px",
                                        }}
                                    >
                                        <Box
                                            sx={{
                                                display: "flex",
                                                alignItems: "center",
                                                gap: 1,
                                                flexWrap: "wrap",
                                            }}
                                        >
                                            <LinkIcon
                                                fontSize="small"
                                                color="action"
                                            />
                                            <MuiLink
                                                href={project.web_url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                underline="hover"
                                                variant="body2"
                                                fontWeight={600}
                                                sx={{ wordBreak: "break-word" }}
                                            >
                                                {project.path_with_namespace}
                                            </MuiLink>
                                            <Chip
                                                label={project.connection.name}
                                                size="small"
                                                variant="outlined"
                                            />
                                        </Box>
                                        <Typography
                                            variant="caption"
                                            color="text.secondary"
                                            component="div"
                                        >
                                            Default branch:{" "}
                                            {project.default_branch}
                                            {project.last_synced_at && (
                                                <>
                                                    {" "}
                                                    · Last synced{" "}
                                                    {new Date(
                                                        project.last_synced_at,
                                                    ).toLocaleString()}
                                                </>
                                            )}
                                        </Typography>
                                    </Box>
                                    <Tooltip title="Unlink project">
                                        <IconButton
                                            size="small"
                                            color="error"
                                            aria-label={`Unlink project ${project.path_with_namespace}`}
                                            onClick={() =>
                                                setUnlinkProject(project)
                                            }
                                            sx={{ ml: "auto" }}
                                        >
                                            <DeleteOutlineIcon fontSize="small" />
                                        </IconButton>
                                    </Tooltip>
                                </Box>
                            ))}
                        </Box>
                    )}
                </Box>
            </SectionCard>

            {/* Create/Edit Connection Dialog */}
            <Dialog
                open={connDialogOpen}
                onClose={
                    connForm.processing
                        ? undefined
                        : () => setConnDialogOpen(false)
                }
                maxWidth="sm"
                fullWidth
                aria-labelledby="gitlab-connection-dialog-title"
            >
                <form onSubmit={handleConnSubmit}>
                    <DialogTitle id="gitlab-connection-dialog-title">
                        {editingConnection
                            ? "Edit GitLab connection"
                            : "Add GitLab connection"}
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
                                        ? "API token (leave blank to keep current)"
                                        : "API token"
                                }
                                value={connForm.data.api_token}
                                onChange={(e) =>
                                    connForm.setData(
                                        "api_token",
                                        e.target.value,
                                    )
                                }
                                error={!!connForm.errors.api_token}
                                helperText={connForm.errors.api_token}
                                type="password"
                                autoComplete="off"
                                fullWidth
                                required={!editingConnection}
                            />
                            <Alert severity="info" icon={<InfoIcon />}>
                                <AlertTitle>
                                    Required token permissions
                                </AlertTitle>
                                Create a <strong>Personal Access Token</strong>{" "}
                                or <strong>Project Access Token</strong> with
                                the <strong>api</strong> scope. This is required
                                for managing webhooks, creating branches, and
                                creating merge requests. The token owner must
                                have <strong>Maintainer</strong> or{" "}
                                <strong>Owner</strong> role on projects you want
                                to link.
                            </Alert>
                            <FormControlLabel
                                control={
                                    <Switch
                                        checked={connForm.data.is_active}
                                        onChange={(e) =>
                                            connForm.setData(
                                                "is_active",
                                                e.target.checked,
                                            )
                                        }
                                    />
                                }
                                label="Active"
                            />
                        </Box>
                    </DialogContent>
                    <DialogActions sx={{ px: 3, py: 2 }}>
                        <Button
                            onClick={() => setConnDialogOpen(false)}
                            disabled={connForm.processing}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            variant="contained"
                            disabled={connForm.processing}
                        >
                            {editingConnection ? "Save" : "Add connection"}
                        </Button>
                    </DialogActions>
                </form>
            </Dialog>

            <ConfirmDialog
                open={!!deleteConnection}
                onClose={() => setDeleteConnection(null)}
                onConfirm={handleDeleteConnection}
                title={`Delete connection “${deleteConnection?.name ?? ""}”?`}
                message="This removes the connection and every project linked through it. Webhooks are cleaned up in GitLab."
                confirmLabel="Delete connection"
                confirmColor="error"
            />

            {/* Link Project Dialog */}
            <Dialog
                open={linkDialogOpen}
                onClose={() => setLinkDialogOpen(false)}
                maxWidth="sm"
                fullWidth
                aria-labelledby="link-project-dialog-title"
            >
                <DialogTitle id="link-project-dialog-title">
                    Link GitLab project
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
                                <InputLabel id="link-project-connection-label">
                                    Connection
                                </InputLabel>
                                <Select
                                    labelId="link-project-connection-label"
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
                                teamSlug={team.slug}
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

            <ConfirmDialog
                open={!!unlinkProject}
                onClose={() => setUnlinkProject(null)}
                onConfirm={handleUnlink}
                title={`Unlink “${unlinkProject?.path_with_namespace ?? ""}”?`}
                message="This removes the project link and every task's GitLab references to it. The webhook is removed from GitLab."
                confirmLabel="Unlink project"
                confirmColor="error"
            />
        </>
    );
}
