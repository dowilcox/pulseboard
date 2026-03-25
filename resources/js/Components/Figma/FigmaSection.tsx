import { useState } from "react";
import type { FigmaConnection, Task, TaskFigmaLink } from "@/types";
import axios from "axios";
import { router } from "@inertiajs/react";
import AddIcon from "@mui/icons-material/Add";
import BrushIcon from "@mui/icons-material/Brush";
import DeleteIcon from "@mui/icons-material/Delete";
import LaunchIcon from "@mui/icons-material/Launch";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CardMedia from "@mui/material/CardMedia";
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
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";

const NODE_TYPE_LABELS: Record<string, string> = {
    CANVAS: "Page",
    FRAME: "Frame",
    COMPONENT: "Component",
    COMPONENT_SET: "Component Set",
    INSTANCE: "Instance",
    GROUP: "Group",
    SECTION: "Section",
};

function humanizeNodeType(type?: string): string | undefined {
    if (!type) return undefined;
    return NODE_TYPE_LABELS[type] ?? type;
}

function buildAppUrl(link: TaskFigmaLink): string {
    const nodeIdParam = link.node_id
        ? `?node-id=${link.node_id.replace(":", "-")}`
        : "";
    return `figma://file/${link.file_key}${nodeIdParam}`;
}

interface Props {
    task: Task;
    teamId: string;
    boardId: string;
    figmaConnections: FigmaConnection[];
    onLinkCreated?: (link: TaskFigmaLink) => void;
    onLinkRemoved?: (linkId: string) => void;
}

export default function FigmaSection({
    task,
    teamId,
    boardId,
    figmaConnections,
    onLinkCreated,
    onLinkRemoved,
}: Props) {
    const [dialogOpen, setDialogOpen] = useState(false);
    const [selectedConnectionId, setSelectedConnectionId] = useState<string>(
        figmaConnections[0]?.id ?? "",
    );
    const [figmaUrl, setFigmaUrl] = useState("");
    const [creating, setCreating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [deletingLinkId, setDeletingLinkId] = useState<string | null>(null);

    const links = task.figma_links ?? [];

    const handleCreate = async () => {
        if (!figmaUrl.trim()) return;

        setCreating(true);
        setError(null);

        try {
            const { data: link } = await axios.post(
                route("tasks.figma.store", [teamId, boardId, task.slug]),
                {
                    figma_connection_id: selectedConnectionId,
                    url: figmaUrl,
                },
            );
            if (onLinkCreated) {
                onLinkCreated(link);
            } else {
                router.reload();
            }
            setDialogOpen(false);
            setFigmaUrl("");
        } catch (e) {
            if (axios.isAxiosError(e) && e.response) {
                setError(e.response.data?.error ?? "Failed to link Figma file");
            } else {
                setError("Network error");
            }
        } finally {
            setCreating(false);
        }
    };

    const handleRemoveLink = async (linkId: string) => {
        try {
            await axios.delete(
                route("tasks.figma.destroy", [
                    teamId,
                    boardId,
                    task.slug,
                    linkId,
                ]),
            );
            if (onLinkRemoved) {
                onLinkRemoved(linkId);
            } else {
                router.reload();
            }
        } catch {
            // Silently fail
        } finally {
            setDeletingLinkId(null);
        }
    };

    if (figmaConnections.length === 0) return null;

    const deletingLink = deletingLinkId
        ? links.find((l) => l.id === deletingLinkId)
        : null;

    return (
        <Box>
            <Box
                sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    mb: 1,
                }}
            >
                <Typography variant="subtitle2" fontWeight={600}>
                    Figma
                </Typography>
                <Button
                    size="small"
                    startIcon={<AddIcon />}
                    onClick={() => setDialogOpen(true)}
                >
                    Link
                </Button>
            </Box>

            {links.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                    No Figma links yet
                </Typography>
            ) : (
                <Box
                    sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}
                >
                    {links.map((link) => {
                        const meta = (link.meta ?? {}) as Record<
                            string,
                            unknown
                        >;
                        const fileName = meta.file_name as string | undefined;
                        const nodeType = meta.node_type as string | undefined;
                        const children = meta.children as
                            | Array<{ name: string; type: string }>
                            | undefined;
                        const isPage = nodeType === "CANVAS";
                        const isFileLevel = !link.node_id;
                        const typeLabel = isFileLevel
                            ? "File"
                            : (humanizeNodeType(nodeType) ?? "Node");
                        const hasNodeContext =
                            link.node_id && fileName && fileName !== link.name;
                        const appUrl = buildAppUrl(link);
                        const showPreview =
                            !isFileLevel && !isPage && !!link.thumbnail_url;

                        return (
                            <Card key={link.id} variant="outlined">
                                {/* Preview image */}
                                {showPreview && (
                                    <Link
                                        href={link.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        sx={{ display: "block" }}
                                    >
                                        <CardMedia
                                            component="img"
                                            image={link.thumbnail_url!}
                                            alt={link.name}
                                            sx={{
                                                height: 140,
                                                objectFit: "contain",
                                                bgcolor: "action.hover",
                                            }}
                                        />
                                    </Link>
                                )}

                                <CardContent
                                    sx={{
                                        py: 1,
                                        px: 1.5,
                                        "&:last-child": { pb: 1 },
                                    }}
                                >
                                    {/* Name + type badge + actions */}
                                    <Box
                                        sx={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 0.75,
                                        }}
                                    >
                                        <Chip
                                            label={typeLabel}
                                            size="small"
                                            variant="outlined"
                                            sx={{
                                                height: 20,
                                                fontSize: "0.7rem",
                                                flexShrink: 0,
                                            }}
                                        />
                                        <Link
                                            href={link.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            variant="body2"
                                            fontWeight={500}
                                            underline="hover"
                                            noWrap
                                            sx={{
                                                flex: 1,
                                                display: "flex",
                                                alignItems: "center",
                                                gap: 0.5,
                                            }}
                                        >
                                            {link.name}
                                            <OpenInNewIcon
                                                sx={{ fontSize: 14 }}
                                            />
                                        </Link>
                                        <Tooltip title="Open in Figma app">
                                            <IconButton
                                                size="small"
                                                component="a"
                                                href={appUrl}
                                            >
                                                <LaunchIcon
                                                    sx={{ fontSize: 16 }}
                                                />
                                            </IconButton>
                                        </Tooltip>
                                        <Tooltip title="Remove link">
                                            <IconButton
                                                size="small"
                                                onClick={() =>
                                                    setDeletingLinkId(link.id)
                                                }
                                            >
                                                <DeleteIcon
                                                    sx={{ fontSize: 16 }}
                                                />
                                            </IconButton>
                                        </Tooltip>
                                    </Box>

                                    {/* File context */}
                                    {hasNodeContext && (
                                        <Typography
                                            variant="caption"
                                            color="text.secondary"
                                            noWrap
                                            display="block"
                                        >
                                            in {fileName}
                                        </Typography>
                                    )}

                                    {/* Page children */}
                                    {isPage &&
                                        children &&
                                        children.length > 0 && (
                                            <Box
                                                sx={{
                                                    mt: 0.75,
                                                    display: "flex",
                                                    flexWrap: "wrap",
                                                    gap: 0.5,
                                                }}
                                            >
                                                {children.map((child, i) => (
                                                    <Chip
                                                        key={i}
                                                        label={child.name}
                                                        size="small"
                                                        variant="filled"
                                                        sx={{
                                                            height: 22,
                                                            fontSize: "0.7rem",
                                                        }}
                                                    />
                                                ))}
                                            </Box>
                                        )}

                                    {/* Last modified */}
                                    {link.last_modified_at && (
                                        <Typography
                                            variant="caption"
                                            color="text.secondary"
                                            display="block"
                                            sx={{ mt: 0.25 }}
                                        >
                                            Modified{" "}
                                            {new Date(
                                                link.last_modified_at,
                                            ).toLocaleDateString()}
                                        </Typography>
                                    )}
                                </CardContent>
                            </Card>
                        );
                    })}
                </Box>
            )}

            {/* Link Dialog */}
            <Dialog
                open={dialogOpen}
                onClose={() => setDialogOpen(false)}
                maxWidth="sm"
                fullWidth
                aria-labelledby="link-figma-dialog-title"
            >
                <DialogTitle id="link-figma-dialog-title">
                    Link Figma Design
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
                        {error && <Alert severity="error">{error}</Alert>}

                        {figmaConnections.length > 1 && (
                            <FormControl fullWidth>
                                <InputLabel>Connection</InputLabel>
                                <Select
                                    value={selectedConnectionId}
                                    label="Connection"
                                    onChange={(e) =>
                                        setSelectedConnectionId(e.target.value)
                                    }
                                >
                                    {figmaConnections.map((conn) => (
                                        <MenuItem key={conn.id} value={conn.id}>
                                            {conn.name}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        )}

                        <TextField
                            label="Figma URL"
                            value={figmaUrl}
                            onChange={(e) => setFigmaUrl(e.target.value)}
                            placeholder="https://www.figma.com/design/abc123/..."
                            helperText="Paste a link to a Figma file, frame, or component"
                            fullWidth
                            autoFocus
                        />
                    </Box>
                </DialogContent>
                <DialogActions sx={{ px: 3, py: 2 }}>
                    <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
                    <Button
                        variant="contained"
                        onClick={handleCreate}
                        disabled={creating || !figmaUrl.trim()}
                        startIcon={
                            creating ? (
                                <CircularProgress size={16} />
                            ) : undefined
                        }
                    >
                        Link
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <Dialog
                open={!!deletingLinkId}
                onClose={() => setDeletingLinkId(null)}
                aria-labelledby="delete-figma-link-dialog-title"
            >
                <DialogTitle id="delete-figma-link-dialog-title">
                    Remove Figma Link
                </DialogTitle>
                <DialogContent>
                    <Typography variant="body2">
                        Remove the link to <strong>{deletingLink?.name}</strong>
                        ? This won't affect the Figma file itself.
                    </Typography>
                </DialogContent>
                <DialogActions sx={{ px: 3, py: 2 }}>
                    <Button onClick={() => setDeletingLinkId(null)}>
                        Cancel
                    </Button>
                    <Button
                        variant="contained"
                        color="error"
                        onClick={() =>
                            deletingLinkId && handleRemoveLink(deletingLinkId)
                        }
                    >
                        Remove
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
