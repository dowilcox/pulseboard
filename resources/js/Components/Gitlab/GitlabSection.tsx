import { useState } from "react";
import type { GitlabProject, Task, TaskGitlabRef } from "@/types";
import { router } from "@inertiajs/react";
import AccountTreeIcon from "@mui/icons-material/AccountTree";
import ClearIcon from "@mui/icons-material/Clear";
import DeleteIcon from "@mui/icons-material/Delete";
import MergeTypeIcon from "@mui/icons-material/MergeType";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import Alert from "@mui/material/Alert";
import Autocomplete from "@mui/material/Autocomplete";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import Link from "@mui/material/Link";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import PipelineBadge from "./PipelineBadge";

interface Props {
    task: Task;
    teamId: string;
    boardId: string;
    gitlabProjects: GitlabProject[];
    onProjectChanged?: (project: GitlabProject | null) => void;
    onRefCreated?: (ref: TaskGitlabRef) => void;
    onRefRemoved?: (refId: string) => void;
}

export default function GitlabSection({
    task,
    teamId,
    boardId,
    gitlabProjects,
    onProjectChanged,
    onRefCreated,
    onRefRemoved,
}: Props) {
    const [settingProject, setSettingProject] = useState(false);
    const [creating, setCreating] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const refs = task.gitlab_refs ?? [];
    const branches = refs.filter((r) => r.ref_type === "branch");
    const mergeRequests = refs.filter((r) => r.ref_type === "merge_request");

    const selectedProject =
        task.gitlab_project ??
        gitlabProjects.find((p) => p.id === task.gitlab_project_id) ??
        null;

    const handleSetProject = async (project: GitlabProject | null) => {
        setSettingProject(true);
        setError(null);

        try {
            const response = await fetch(
                route("tasks.gitlab.set-project", [teamId, boardId, task.id]),
                {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json",
                        "X-CSRF-TOKEN":
                            document.querySelector<HTMLMetaElement>(
                                'meta[name="csrf-token"]',
                            )?.content ?? "",
                        Accept: "application/json",
                    },
                    body: JSON.stringify({
                        gitlab_project_id: project?.id ?? null,
                    }),
                },
            );

            if (response.ok) {
                if (onProjectChanged) {
                    onProjectChanged(project);
                } else {
                    router.reload();
                }
            } else {
                const data = await response.json();
                setError(data.message ?? "Failed to set project");
            }
        } catch {
            setError("Network error");
        } finally {
            setSettingProject(false);
        }
    };

    const handleCreate = async (type: "branch" | "merge_request") => {
        if (!selectedProject) return;

        setCreating(true);
        setError(null);

        const routeName =
            type === "branch"
                ? "tasks.gitlab.branch"
                : "tasks.gitlab.merge-request";

        try {
            const response = await fetch(
                route(routeName, [teamId, boardId, task.id]),
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
                    body: JSON.stringify({}),
                },
            );

            if (response.ok) {
                const ref = await response.json();
                if (onRefCreated) {
                    onRefCreated(ref);
                } else {
                    router.reload();
                }
            } else {
                const data = await response.json();
                setError(data.error ?? "Failed to create");
            }
        } catch {
            setError("Network error");
        } finally {
            setCreating(false);
        }
    };

    const handleRemoveRef = async (refId: string) => {
        try {
            const response = await fetch(
                route("tasks.gitlab.destroy", [
                    teamId,
                    boardId,
                    task.id,
                    refId,
                ]),
                {
                    method: "DELETE",
                    headers: {
                        "X-CSRF-TOKEN":
                            document.querySelector<HTMLMetaElement>(
                                'meta[name="csrf-token"]',
                            )?.content ?? "",
                        Accept: "application/json",
                    },
                },
            );
            if (response.ok) {
                if (onRefRemoved) {
                    onRefRemoved(refId);
                } else {
                    router.reload();
                }
            }
        } catch {
            // Silently fail
        }
    };

    if (gitlabProjects.length === 0) return null;

    return (
        <Box>
            <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>
                GitLab
            </Typography>

            {error && (
                <Alert
                    severity="error"
                    sx={{ mb: 1 }}
                    onClose={() => setError(null)}
                >
                    {error}
                </Alert>
            )}

            {/* Project Selector */}
            <Box sx={{ mb: 1.5 }}>
                <Typography
                    variant="caption"
                    color="text.secondary"
                    fontWeight={600}
                >
                    Project
                </Typography>
                <Autocomplete
                    size="small"
                    options={gitlabProjects}
                    value={selectedProject}
                    onChange={(_e, newValue) => handleSetProject(newValue)}
                    getOptionLabel={(option) => option.path_with_namespace}
                    isOptionEqualToValue={(option, value) =>
                        option.id === value.id
                    }
                    loading={settingProject}
                    clearIcon={<ClearIcon fontSize="small" />}
                    renderOption={(props, option) => (
                        <li {...props} key={option.id}>
                            <Box>
                                <Typography variant="body2">
                                    {option.name}
                                </Typography>
                                <Typography
                                    variant="caption"
                                    color="text.secondary"
                                >
                                    {option.path_with_namespace}
                                </Typography>
                            </Box>
                        </li>
                    )}
                    renderInput={(params) => (
                        <TextField
                            {...params}
                            placeholder="Select a project..."
                            slotProps={{
                                input: {
                                    ...params.InputProps,
                                    endAdornment: (
                                        <>
                                            {settingProject && (
                                                <CircularProgress
                                                    size={16}
                                                    sx={{ mr: 1 }}
                                                />
                                            )}
                                            {params.InputProps.endAdornment}
                                        </>
                                    ),
                                },
                            }}
                        />
                    )}
                />
            </Box>

            {/* Actions & Refs (shown when a project is selected) */}
            {selectedProject && (
                <>
                    {/* Action Buttons */}
                    <Box
                        sx={{
                            display: "flex",
                            gap: 1,
                            mb: 1.5,
                        }}
                    >
                        <Button
                            size="small"
                            variant="outlined"
                            startIcon={
                                creating ? (
                                    <CircularProgress size={14} />
                                ) : (
                                    <AccountTreeIcon sx={{ fontSize: 16 }} />
                                )
                            }
                            onClick={() => handleCreate("branch")}
                            disabled={creating}
                            sx={{ flex: 1, textTransform: "none" }}
                        >
                            Create Branch
                        </Button>
                        <Button
                            size="small"
                            variant="outlined"
                            startIcon={
                                creating ? (
                                    <CircularProgress size={14} />
                                ) : (
                                    <MergeTypeIcon sx={{ fontSize: 16 }} />
                                )
                            }
                            onClick={() => handleCreate("merge_request")}
                            disabled={creating}
                            sx={{ flex: 1, textTransform: "none" }}
                        >
                            Create MR
                        </Button>
                    </Box>

                    {/* Existing Refs */}
                    {refs.length > 0 && (
                        <List dense disablePadding>
                            {mergeRequests.map((ref) => (
                                <ListItem
                                    key={ref.id}
                                    disableGutters
                                    secondaryAction={
                                        <Tooltip title="Remove">
                                            <IconButton
                                                edge="end"
                                                size="small"
                                                onClick={() =>
                                                    handleRemoveRef(ref.id)
                                                }
                                            >
                                                <DeleteIcon fontSize="small" />
                                            </IconButton>
                                        </Tooltip>
                                    }
                                >
                                    <ListItemIcon sx={{ minWidth: 32 }}>
                                        <MergeTypeIcon
                                            fontSize="small"
                                            color="info"
                                        />
                                    </ListItemIcon>
                                    <ListItemText
                                        primary={
                                            <Box
                                                sx={{
                                                    display: "flex",
                                                    alignItems: "center",
                                                    gap: 1,
                                                }}
                                            >
                                                <Link
                                                    href={ref.url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    variant="body2"
                                                    underline="hover"
                                                    sx={{
                                                        display: "flex",
                                                        alignItems: "center",
                                                        gap: 0.5,
                                                    }}
                                                >
                                                    !{ref.gitlab_iid}{" "}
                                                    {ref.title}
                                                    <OpenInNewIcon
                                                        sx={{ fontSize: 14 }}
                                                    />
                                                </Link>
                                                <PipelineBadge
                                                    status={ref.pipeline_status}
                                                />
                                            </Box>
                                        }
                                        secondary={
                                            <Typography
                                                variant="caption"
                                                color="text.secondary"
                                            >
                                                {ref.state} · {ref.author}
                                            </Typography>
                                        }
                                    />
                                </ListItem>
                            ))}

                            {branches.length > 0 &&
                                mergeRequests.length > 0 && (
                                    <Divider sx={{ my: 0.5 }} />
                                )}

                            {branches.map((ref) => (
                                <ListItem
                                    key={ref.id}
                                    disableGutters
                                    secondaryAction={
                                        <Tooltip title="Remove">
                                            <IconButton
                                                edge="end"
                                                size="small"
                                                onClick={() =>
                                                    handleRemoveRef(ref.id)
                                                }
                                            >
                                                <DeleteIcon fontSize="small" />
                                            </IconButton>
                                        </Tooltip>
                                    }
                                >
                                    <ListItemIcon sx={{ minWidth: 32 }}>
                                        <AccountTreeIcon
                                            fontSize="small"
                                            color="action"
                                        />
                                    </ListItemIcon>
                                    <ListItemText
                                        primary={
                                            <Link
                                                href={ref.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                variant="body2"
                                                underline="hover"
                                                sx={{
                                                    display: "flex",
                                                    alignItems: "center",
                                                    gap: 0.5,
                                                }}
                                            >
                                                {ref.gitlab_ref}
                                                <OpenInNewIcon
                                                    sx={{ fontSize: 14 }}
                                                />
                                            </Link>
                                        }
                                    />
                                </ListItem>
                            ))}
                        </List>
                    )}
                </>
            )}
        </Box>
    );
}
