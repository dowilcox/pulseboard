import type { Task, TaskSummary } from "@/types";
import { router } from "@inertiajs/react";
import AddIcon from "@mui/icons-material/Add";
import CloseIcon from "@mui/icons-material/Close";
import Autocomplete from "@mui/material/Autocomplete";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useState } from "react";

interface Props {
    task: Task;
    boardTasks: TaskSummary[];
    teamId: string;
    boardId: string;
}

const DEPENDENCY_TEXT = "#f8fafc";
const DEPENDENCY_MUTED = "#cbd5e1";
const DEPENDENCY_SUBTLE = "#a8b3c7";
const DEPENDENCY_HOVER = "rgba(148, 163, 184, 0.14)";

export default function DependencySection({
    task,
    boardTasks,
    teamId,
    boardId,
}: Props) {
    const [addingBlockedBy, setAddingBlockedBy] = useState(false);
    const [addingBlocking, setAddingBlocking] = useState(false);
    const [selectedTask, setSelectedTask] = useState<TaskSummary | null>(null);

    const blockedBy = task.blocked_by ?? [];
    const dependencies = task.dependencies ?? [];

    const availableForBlockedBy = boardTasks.filter(
        (t) => t.id !== task.id && !blockedBy.some((b) => b.id === t.id),
    );
    const availableForBlocking = boardTasks.filter(
        (t) => t.id !== task.id && !dependencies.some((d) => d.id === t.id),
    );

    const handleAddBlockedBy = (depTask: TaskSummary) => {
        router.post(
            route("tasks.dependencies.store", [teamId, boardId, task.slug]),
            { depends_on_task_id: depTask.id },
            { preserveScroll: true },
        );
        setAddingBlockedBy(false);
        setSelectedTask(null);
    };

    const handleAddBlocking = (depTask: TaskSummary) => {
        router.post(
            route("tasks.dependencies.store", [teamId, boardId, depTask.slug]),
            { depends_on_task_id: task.id },
            { preserveScroll: true },
        );
        setAddingBlocking(false);
        setSelectedTask(null);
    };

    const handleRemoveBlockedBy = (depTaskId: string) => {
        router.delete(
            route("tasks.dependencies.destroy", [
                teamId,
                boardId,
                task.slug,
                depTaskId,
            ]),
            { preserveScroll: true },
        );
    };

    const handleRemoveBlocking = (depTaskId: string) => {
        router.delete(
            route("tasks.dependencies.destroy", [
                teamId,
                boardId,
                depTaskId,
                task.slug,
            ]),
            { preserveScroll: true },
        );
    };

    const formatTaskLabel = (t: TaskSummary | Task) => {
        const num = t.task_number ? `#${t.task_number}` : "";
        return `${num} ${t.title}`.trim();
    };

    const depRow = (
        label: string,
        items: Task[],
        adding: boolean,
        setAdding: (v: boolean) => void,
        available: TaskSummary[],
        onAdd: (t: TaskSummary) => void,
        onRemove: (id: string) => void,
        color: "warning" | "info",
    ) => (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}>
            <Box
                sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                }}
            >
                <Typography
                    variant="caption"
                    fontWeight={600}
                    sx={{ color: DEPENDENCY_MUTED }}
                >
                    {label}
                </Typography>
                {!adding && (
                    <Button
                        size="small"
                        startIcon={
                            <AddIcon sx={{ fontSize: "14px !important" }} />
                        }
                        onClick={() => setAdding(true)}
                        sx={{
                            textTransform: "none",
                            color: DEPENDENCY_MUTED,
                            fontSize: "0.7rem",
                            minWidth: 0,
                            py: 0,
                            px: 0.5,
                            "&:hover": {
                                color: DEPENDENCY_TEXT,
                                bgcolor: DEPENDENCY_HOVER,
                            },
                        }}
                    >
                        Add
                    </Button>
                )}
            </Box>

            {items.length > 0 ? (
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                    {items.map((dep) => (
                        <Chip
                            key={dep.id}
                            label={formatTaskLabel(dep)}
                            size="small"
                            color={color}
                            variant="outlined"
                            onDelete={() => onRemove(dep.slug ?? dep.id)}
                            deleteIcon={
                                <CloseIcon
                                    sx={{ fontSize: "14px !important" }}
                                />
                            }
                            sx={{
                                maxWidth: "100%",
                                height: 24,
                                fontSize: "0.75rem",
                            }}
                            aria-label={`${label}: ${formatTaskLabel(dep)}`}
                        />
                    ))}
                </Box>
            ) : !adding ? (
                <Typography
                    variant="caption"
                    sx={{ color: DEPENDENCY_SUBTLE, fontStyle: "italic" }}
                >
                    None
                </Typography>
            ) : null}

            {adding && (
                <Autocomplete
                    size="small"
                    options={available}
                    getOptionLabel={formatTaskLabel}
                    value={selectedTask}
                    onChange={(_, value) => {
                        if (value) onAdd(value);
                    }}
                    onBlur={() => setAdding(false)}
                    renderInput={(params) => (
                        <TextField
                            {...params}
                            placeholder="Search tasks..."
                            autoFocus
                            inputProps={{
                                ...params.inputProps,
                                "aria-label": `Search for ${label.toLowerCase()} task`,
                            }}
                        />
                    )}
                    noOptionsText="No available tasks"
                    sx={{
                        "& .MuiInputBase-root": { py: "2px" },
                    }}
                />
            )}
        </Box>
    );

    return (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
            {depRow(
                "Blocked by",
                blockedBy,
                addingBlockedBy,
                setAddingBlockedBy,
                availableForBlockedBy,
                handleAddBlockedBy,
                handleRemoveBlockedBy,
                "warning",
            )}
            {depRow(
                "Blocking",
                dependencies,
                addingBlocking,
                setAddingBlocking,
                availableForBlocking,
                handleAddBlocking,
                handleRemoveBlocking,
                "info",
            )}
        </Box>
    );
}
