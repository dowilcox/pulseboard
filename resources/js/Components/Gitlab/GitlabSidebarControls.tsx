import { useState } from "react";
import { harbor, harborHex } from "@/theme/harbor";
import type { GitlabProject, Task } from "@/types";
import axios from "axios";
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
    teamSlug: string;
    boardSlug: string;
    gitlabProjects: GitlabProject[];
}

/** Outline-indigo Harbor button — 1.5px inset ring, transparent fill. */
const outlineButtonSx = {
    height: 38,
    borderRadius: "10px",
    fontSize: 13,
    fontWeight: 700,
    color: harborHex.accent,
    boxShadow: `inset 0 0 0 1.5px ${harborHex.accent}`,
    transition: "background-color 150ms ease-out",
    "&:hover": { bgcolor: "rgba(57, 89, 166, 0.08)" },
    "&.Mui-disabled": {
        color: harbor.faint,
        boxShadow: `inset 0 0 0 1.5px ${harbor.track}`,
    },
} as const;

export default function GitlabSidebarControls({
    task,
    teamSlug,
    boardSlug,
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
            await axios.put(
                route("tasks.gitlab.set-project", [
                    teamSlug,
                    boardSlug,
                    task.slug,
                ]),
                { gitlab_project_id: project?.id ?? null },
            );
            router.reload();
        } catch (e) {
            if (axios.isAxiosError(e) && e.response) {
                setError(e.response.data?.message ?? "Failed to set project");
            } else {
                setError("Network error");
            }
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
            await axios.post(
                route(routeName, [teamSlug, boardSlug, task.slug]),
                {},
            );
            router.reload();
        } catch (e) {
            if (axios.isAxiosError(e) && e.response) {
                setError(e.response.data?.error ?? "Failed to create");
            } else {
                setError("Network error");
            }
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
                sx={{
                    "& .MuiOutlinedInput-root": {
                        fontSize: 13,
                        fontWeight: 600,
                        color: harbor.ink,
                    },
                }}
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
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
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
                                fullWidth
                                startIcon={
                                    creating ? (
                                        <CircularProgress size={14} />
                                    ) : (
                                        <AccountTreeIcon
                                            sx={{ fontSize: 15 }}
                                        />
                                    )
                                }
                                onClick={() => handleCreate("branch")}
                                disabled={creating || hasBranch}
                                aria-label="Create branch"
                                sx={outlineButtonSx}
                            >
                                Branch
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
                                fullWidth
                                startIcon={
                                    creating ? (
                                        <CircularProgress size={14} />
                                    ) : (
                                        <MergeTypeIcon sx={{ fontSize: 15 }} />
                                    )
                                }
                                onClick={() => handleCreate("merge_request")}
                                disabled={creating || hasOpenMr}
                                aria-label="Create merge request"
                                sx={outlineButtonSx}
                            >
                                MR
                            </Button>
                        </span>
                    </Tooltip>
                </Box>
            )}
        </Box>
    );
}
