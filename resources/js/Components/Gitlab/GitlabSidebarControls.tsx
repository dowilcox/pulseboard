import { useState } from "react";
import type { GitlabProject, Task } from "@/types";
import { router } from "@inertiajs/react";
import AccountTreeIcon from "@mui/icons-material/AccountTree";
import ClearIcon from "@mui/icons-material/Clear";
import MergeTypeIcon from "@mui/icons-material/MergeType";
import Alert from "@mui/material/Alert";
import Autocomplete from "@mui/material/Autocomplete";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";

interface Props {
    task: Task;
    teamId: string;
    boardId: string;
    gitlabProjects: GitlabProject[];
}

export default function GitlabSidebarControls({
    task,
    teamId,
    boardId,
    gitlabProjects,
}: Props) {
    const [settingProject, setSettingProject] = useState(false);
    const [creating, setCreating] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const refs = task.gitlab_refs ?? [];
    const hasBranch = refs.some((r) => r.ref_type === "branch");
    const hasOpenMr = refs.some(
        (r) =>
            r.ref_type === "merge_request" &&
            (r.state === "opened" || r.state === "locked"),
    );

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
                router.reload();
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
                router.reload();
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

    if (gitlabProjects.length === 0) return null;

    return (
        <Box>
            {error && (
                <Alert
                    severity="error"
                    sx={{ mb: 1 }}
                    onClose={() => setError(null)}
                >
                    {error}
                </Alert>
            )}

            <Autocomplete
                size="small"
                options={gitlabProjects}
                value={selectedProject}
                onChange={(_e, newValue) => handleSetProject(newValue)}
                getOptionLabel={(option) => option.path_with_namespace}
                isOptionEqualToValue={(option, value) => option.id === value.id}
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

            {selectedProject && (
                <Box
                    sx={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 1,
                        mt: 1,
                    }}
                >
                    <Tooltip
                        title={
                            hasBranch
                                ? "A branch already exists for this task"
                                : ""
                        }
                    >
                        <span>
                            <Button
                                size="small"
                                variant="outlined"
                                fullWidth
                                startIcon={
                                    creating ? (
                                        <CircularProgress size={14} />
                                    ) : (
                                        <AccountTreeIcon
                                            sx={{ fontSize: 16 }}
                                        />
                                    )
                                }
                                onClick={() => handleCreate("branch")}
                                disabled={creating || hasBranch}
                                sx={{ textTransform: "none" }}
                            >
                                Create Branch
                            </Button>
                        </span>
                    </Tooltip>
                    <Tooltip
                        title={
                            hasOpenMr
                                ? "An open merge request already exists"
                                : ""
                        }
                    >
                        <span>
                            <Button
                                size="small"
                                variant="outlined"
                                fullWidth
                                startIcon={
                                    creating ? (
                                        <CircularProgress size={14} />
                                    ) : (
                                        <MergeTypeIcon sx={{ fontSize: 16 }} />
                                    )
                                }
                                onClick={() => handleCreate("merge_request")}
                                disabled={creating || hasOpenMr}
                                sx={{ textTransform: "none" }}
                            >
                                Create MR
                            </Button>
                        </span>
                    </Tooltip>
                </Box>
            )}
        </Box>
    );
}
