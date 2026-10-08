import { harbor, harborHex } from "@/theme/harbor";
import type { Board, Task, TaskSummary } from "@/types";
import { router } from "@inertiajs/react";
import RouterLink from "@/Components/Common/RouterLink";
import AddIcon from "@mui/icons-material/Add";
import CloseIcon from "@mui/icons-material/Close";
import Autocomplete from "@mui/material/Autocomplete";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Link from "@mui/material/Link";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useState } from "react";

interface Props {
    task: Task;
    /** Candidates: this board's tasks plus open tasks on the team's other boards. */
    boardTasks: TaskSummary[];
    teamSlug: string;
    board: Pick<Board, "id" | "name" | "slug">;
    canEdit?: boolean;
}

type Tone = "warning" | "info";

const toneColors: Record<Tone, { fg: string; border: string }> = {
    warning: { fg: harbor.dueSoon.fg, border: harbor.dueSoon.fg },
    info: { fg: harborHex.accent, border: harborHex.accent },
};

function taskLabel(t: Pick<TaskSummary, "task_number" | "title">): string {
    const num = t.task_number ? `#${t.task_number}` : "";
    return `${num} ${t.title}`.trim();
}

export default function DependencySection({
    task,
    boardTasks,
    teamSlug,
    board,
    canEdit = true,
}: Props) {
    const [addingBlockedBy, setAddingBlockedBy] = useState(false);
    const [addingBlocking, setAddingBlocking] = useState(false);

    const blockedBy = task.blocked_by ?? [];
    const dependencies = task.dependencies ?? [];

    const boardOf = (t: { board_id?: string; board?: TaskSummary["board"] }) =>
        t.board ?? (t.board_id === board.id || !t.board_id ? board : null);

    const isOtherBoard = (t: { board_id?: string }) =>
        !!t.board_id && t.board_id !== board.id;

    const availableForBlockedBy = boardTasks.filter(
        (t) => t.id !== task.id && !blockedBy.some((b) => b.id === t.id),
    );
    const availableForBlocking = boardTasks.filter(
        (t) => t.id !== task.id && !dependencies.some((d) => d.id === t.id),
    );

    const handleAddBlockedBy = (depTask: TaskSummary) => {
        router.post(
            route("tasks.dependencies.store", [
                teamSlug,
                board.slug,
                task.slug ?? task.id,
            ]),
            { depends_on_task_id: depTask.id },
            { preserveScroll: true },
        );
        setAddingBlockedBy(false);
    };

    // The other task becomes the dependent one, so post to its own board.
    const handleAddBlocking = (depTask: TaskSummary) => {
        router.post(
            route("tasks.dependencies.store", [
                teamSlug,
                boardOf(depTask)?.slug ?? depTask.board_id ?? board.slug,
                depTask.slug ?? depTask.id,
            ]),
            { depends_on_task_id: task.id },
            { preserveScroll: true },
        );
        setAddingBlocking(false);
    };

    // Route shape: {team}/{board}/tasks/{task}/dependencies/{dependsOnTask}.
    // {task} is resolved scoped to {board}, while {dependsOnTask} is resolved
    // globally when given a UUID — so always pass UUIDs for the other task,
    // and use the dependent task's own board for {board} so cross-board
    // dependencies resolve correctly.
    const handleRemoveBlockedBy = (depTask: Task) => {
        router.delete(
            route("tasks.dependencies.destroy", [
                teamSlug,
                board.slug,
                task.slug ?? task.id,
                depTask.id,
            ]),
            { preserveScroll: true },
        );
    };

    const handleRemoveBlocking = (depTask: Task) => {
        router.delete(
            route("tasks.dependencies.destroy", [
                teamSlug,
                depTask.board?.slug ?? depTask.board_id,
                depTask.slug ?? depTask.id,
                task.id,
            ]),
            { preserveScroll: true },
        );
    };

    const depChip = (
        dep: Task,
        label: string,
        tone: Tone,
        onRemove: (t: Task) => void,
    ) => {
        const depBoard = boardOf(dep);
        const crossBoard = isOtherBoard(dep);
        const text = taskLabel(dep);
        const colors = toneColors[tone];
        const href = depBoard
            ? route("tasks.show", [teamSlug, depBoard.slug, dep.slug ?? dep.id])
            : null;

        return (
            <Box
                key={dep.id}
                sx={{
                    display: "inline-flex",
                    alignItems: "center",
                    maxWidth: "100%",
                    minHeight: 26,
                    pl: 1,
                    pr: canEdit ? 0.25 : 1,
                    borderRadius: 999,
                    border: `1px solid ${colors.border}`,
                    bgcolor: harbor.card,
                }}
            >
                {href ? (
                    <Link
                        component={RouterLink}
                        href={href}
                        underline="hover"
                        title={
                            crossBoard && depBoard
                                ? `${depBoard.name} · ${text}`
                                : text
                        }
                        sx={{
                            minWidth: 0,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            fontSize: 12,
                            fontWeight: 600,
                            color: colors.fg,
                            py: "3px",
                        }}
                    >
                        {crossBoard && depBoard && (
                            <Box
                                component="span"
                                sx={{ color: harbor.sub, fontWeight: 700 }}
                            >
                                {depBoard.name} ·{" "}
                            </Box>
                        )}
                        {text}
                    </Link>
                ) : (
                    <Typography
                        component="span"
                        noWrap
                        sx={{ fontSize: 12, fontWeight: 600, color: colors.fg }}
                    >
                        {text}
                    </Typography>
                )}
                {canEdit && (
                    <IconButton
                        size="small"
                        onClick={() => onRemove(dep)}
                        aria-label={`Remove ${label.toLowerCase()} ${text}`}
                        sx={{
                            ml: 0.25,
                            p: "3px",
                            color: harbor.faint,
                            "&:hover": { color: harbor.ink },
                        }}
                    >
                        <CloseIcon sx={{ fontSize: 14 }} />
                    </IconButton>
                )}
            </Box>
        );
    };

    const depRow = (
        label: string,
        items: Task[],
        adding: boolean,
        setAdding: (v: boolean) => void,
        available: TaskSummary[],
        onAdd: (t: TaskSummary) => void,
        onRemove: (t: Task) => void,
        tone: Tone,
    ) => (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
            <Box
                sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                }}
            >
                <Typography
                    component="span"
                    sx={{
                        fontSize: 10.5,
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: "0.07em",
                        color: harbor.faint,
                    }}
                >
                    {label}
                </Typography>
                {canEdit && !adding && (
                    <Button
                        size="small"
                        startIcon={
                            <AddIcon sx={{ fontSize: "13px !important" }} />
                        }
                        onClick={() => setAdding(true)}
                        aria-label={`Add ${label.toLowerCase()} task`}
                        sx={{
                            color: harborHex.accent,
                            fontSize: 11.5,
                            fontWeight: 700,
                            minWidth: 0,
                            py: 0,
                            px: 0.5,
                            "&:hover": {
                                bgcolor: "transparent",
                                textDecoration: "underline",
                            },
                        }}
                    >
                        Add
                    </Button>
                )}
            </Box>

            {items.length > 0 ? (
                <Box
                    component="ul"
                    sx={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: 0.5,
                        listStyle: "none",
                        m: 0,
                        p: 0,
                        "& > li": { display: "flex", maxWidth: "100%" },
                    }}
                >
                    {items.map((dep) => (
                        <li key={dep.id}>
                            {depChip(dep, label, tone, onRemove)}
                        </li>
                    ))}
                </Box>
            ) : !adding ? (
                <Typography sx={{ fontSize: 12.5, color: harbor.faint }}>
                    None
                </Typography>
            ) : null}

            {adding && (
                <Autocomplete
                    size="small"
                    options={available}
                    groupBy={(option) => boardOf(option)?.name ?? board.name}
                    getOptionLabel={taskLabel}
                    value={null}
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
