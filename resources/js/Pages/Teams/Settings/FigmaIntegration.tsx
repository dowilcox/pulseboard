import ConfirmDialog from "@/Components/Common/ConfirmDialog";
import type { FigmaConnection, Team } from "@/types";
import { router, useForm } from "@inertiajs/react";
import AddIcon from "@mui/icons-material/Add";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import EditIcon from "@mui/icons-material/Edit";
import ErrorIcon from "@mui/icons-material/Error";
import InfoIcon from "@mui/icons-material/Info";
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
import FormControlLabel from "@mui/material/FormControlLabel";
import IconButton from "@mui/material/IconButton";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import axios from "axios";
import { useState } from "react";
import SectionCard from "./SectionCard";

interface Props {
    team: Team;
    connections: FigmaConnection[];
}

interface TestResult {
    success: boolean;
    message: string;
}

/** Figma connections (Integrations tab of team settings). */
export default function FigmaIntegration({ team, connections }: Props) {
    const [connDialogOpen, setConnDialogOpen] = useState(false);
    const [editingConnection, setEditingConnection] =
        useState<FigmaConnection | null>(null);
    const [deleteConnection, setDeleteConnection] =
        useState<FigmaConnection | null>(null);
    const [testResults, setTestResults] = useState<Record<string, TestResult>>(
        {},
    );
    const [testingIds, setTestingIds] = useState<Set<string>>(new Set());

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

    const handleConnSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const options = {
            preserveScroll: true,
            onSuccess: () => setConnDialogOpen(false),
        };
        if (editingConnection) {
            connForm.put(
                route("teams.figma-connections.update", [
                    team.slug,
                    editingConnection.id,
                ]),
                options,
            );
        } else {
            connForm.post(
                route("teams.figma-connections.store", team.slug),
                options,
            );
        }
    };

    const handleDeleteConnection = () => {
        if (!deleteConnection) return;
        router.delete(
            route("teams.figma-connections.destroy", [
                team.slug,
                deleteConnection.id,
            ]),
            {
                preserveScroll: true,
                onSuccess: () => setDeleteConnection(null),
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

    return (
        <>
            <SectionCard
                title="Figma"
                description="Connect Figma so tasks can link to designs and show previews."
                action={
                    <Button
                        size="small"
                        startIcon={<AddIcon />}
                        onClick={openCreateConnection}
                    >
                        Add connection
                    </Button>
                }
            >
                {connections.length === 0 ? (
                    <Typography variant="body2" color="text.secondary">
                        No Figma connections yet. Add a connection to start
                        linking designs to tasks.
                    </Typography>
                ) : (
                    <Box component="ul" sx={{ listStyle: "none", m: 0, p: 0 }}>
                        {connections.map((connection) => {
                            const result = testResults[connection.id];
                            const testing = testingIds.has(connection.id);
                            return (
                                <Box
                                    component="li"
                                    key={connection.id}
                                    sx={{
                                        display: "flex",
                                        alignItems: "center",
                                        flexWrap: "wrap",
                                        columnGap: 2,
                                        rowGap: 1,
                                        py: 1.25,
                                        borderTop: 1,
                                        borderColor: "divider",
                                        "&:first-of-type": { borderTop: 0 },
                                    }}
                                >
                                    <Box
                                        sx={{ minWidth: 0, flex: "1 1 220px" }}
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
                aria-labelledby="figma-connection-dialog-title"
            >
                <form onSubmit={handleConnSubmit}>
                    <DialogTitle id="figma-connection-dialog-title">
                        {editingConnection
                            ? "Edit Figma connection"
                            : "Add Figma connection"}
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
                                        ? "Personal access token (leave blank to keep current)"
                                        : "Personal access token"
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
                                    How to create a Figma token
                                </AlertTitle>
                                Go to{" "}
                                <strong>
                                    Figma Settings &rarr; Security &rarr;
                                    Personal access tokens
                                </strong>{" "}
                                and generate a new token with the following
                                scopes:
                                <Box
                                    component="ul"
                                    sx={{ mt: 0.5, mb: 0, pl: 2.5 }}
                                >
                                    <li>
                                        <strong>File metadata (Read)</strong> —
                                        file names, thumbnails, and last
                                        modified dates
                                    </li>
                                    <li>
                                        <strong>File content (Read)</strong> —
                                        node previews, frame names, and rendered
                                        thumbnails
                                    </li>
                                </Box>
                                <Typography
                                    variant="caption"
                                    sx={{ display: "block", mt: 0.5 }}
                                >
                                    Tokens expire after 90 days. Both scopes are
                                    recommended. Without File content, links
                                    will still work but won't show design
                                    previews or node details.
                                </Typography>
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
                message="This removes the connection and every Figma link on tasks that uses it."
                confirmLabel="Delete connection"
                confirmColor="error"
            />
        </>
    );
}
