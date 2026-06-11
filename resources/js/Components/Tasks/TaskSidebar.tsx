import ConfirmDialog from "@/Components/Common/ConfirmDialog";
import GitlabSidebarControls from "@/Components/Gitlab/GitlabSidebarControls";
import AssigneeSelector from "@/Components/Tasks/AssigneeSelector";
import DependencySection from "@/Components/Tasks/DependencySection";
import LabelSelector from "@/Components/Tasks/LabelSelector";
import PrioritySelector from "@/Components/Tasks/PrioritySelector";
import RecurrenceConfig from "@/Components/Tasks/RecurrenceConfig";
import { harbor, harborHex } from "@/theme/harbor";
import { formatTimestamp } from "@/utils/formatTimestamp";
import type {
    Board,
    GitlabProject,
    Label,
    PageProps,
    RecurrenceConfig as RecurrenceConfigType,
    Task,
    TaskSummary,
    User,
} from "@/types";
import type { RequestPayload } from "@inertiajs/core";
import { router, usePage } from "@inertiajs/react";
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";
import CheckIcon from "@mui/icons-material/Check";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import DashboardIcon from "@mui/icons-material/Dashboard";
import DeleteIcon from "@mui/icons-material/Delete";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useCallback, useEffect, useRef, useState } from "react";

interface Props {
    task: Task;
    team: { id: string; name: string; slug: string };
    board: Board;
    members: User[];
    labels: Label[];
    boardTasks: TaskSummary[];
    teamBoards: Board[];
    gitlabProjects?: GitlabProject[];
    isWatching: boolean;
}

/** Harbor sidebar group card. */
const groupCardSx = {
    bgcolor: harbor.card,
    borderRadius: "16px",
    boxShadow: harbor.cardShadow,
    p: "14px 16px",
    display: "flex",
    flexDirection: "column",
} as const;

/** Shared sizing for the sidebar selects/inputs — 38px Harbor controls. */
const controlSx = {
    height: 38,
    fontSize: 13,
    fontWeight: 600,
    color: harbor.ink,
    "& .MuiSelect-icon": { color: harbor.faint },
} as const;

export default function TaskSidebar({
    task,
    team,
    board,
    members,
    labels,
    boardTasks,
    teamBoards,
    gitlabProjects = [],
    isWatching,
}: Props) {
    const { teams: sharedTeams } = usePage<PageProps>().props;
    const userRole = sharedTeams?.find((t) => t.id === team.id)?.pivot?.role;
    const canManageTemplates = userRole === "owner" || userRole === "admin";

    const columns = board.columns ?? [];
    const isCompleted = task.completed_at != null;

    const [dueDate, setDueDate] = useState(task.due_date ?? "");
    const [effortEstimate, setEffortEstimate] = useState<string>(
        task.effort_estimate != null ? String(task.effort_estimate) : "",
    );
    const [recurrenceConfig, setRecurrenceConfig] =
        useState<RecurrenceConfigType | null>(task.recurrence_config ?? null);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
    const [templateName, setTemplateName] = useState("");

    const dueDateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
        null,
    );
    const effortTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const recurrenceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
        null,
    );

    useEffect(() => {
        return () => {
            if (dueDateTimeoutRef.current)
                clearTimeout(dueDateTimeoutRef.current);
            if (effortTimeoutRef.current)
                clearTimeout(effortTimeoutRef.current);
            if (recurrenceTimeoutRef.current)
                clearTimeout(recurrenceTimeoutRef.current);
        };
    }, []);

    useEffect(() => {
        if (!dueDateTimeoutRef.current) {
            setDueDate(task.due_date ?? "");
        }
    }, [task.due_date]);

    useEffect(() => {
        if (!effortTimeoutRef.current) {
            setEffortEstimate(
                task.effort_estimate != null
                    ? String(task.effort_estimate)
                    : "",
            );
        }
    }, [task.effort_estimate]);

    useEffect(() => {
        if (!recurrenceTimeoutRef.current) {
            setRecurrenceConfig(task.recurrence_config ?? null);
        }
    }, [task.recurrence_config]);

    const saveField = useCallback(
        (data: Record<string, unknown>) => {
            router.put(
                route("tasks.update", [team.slug, board.slug, task.slug]),
                data as RequestPayload,
                {
                    preserveScroll: true,
                    preserveState: true,
                },
            );
        },
        [team.slug, board.slug, task.slug],
    );

    const handleColumnChange = (columnId: string) => {
        const targetColumn = columns.find((c) => c.id === columnId);
        const maxSort = (targetColumn?.tasks ?? []).reduce(
            (max, t) => Math.max(max, t.sort_order ?? 0),
            0,
        );
        router.patch(
            route("tasks.move", [team.slug, board.slug, task.slug]),
            { column_id: columnId, sort_order: maxSort + 1 },
            { preserveScroll: true },
        );
    };

    const handleBoardChange = (newBoardId: string) => {
        if (newBoardId === board.id) return;
        const targetBoard = teamBoards.find((b) => b.id === newBoardId);
        const firstColumn = targetBoard?.columns?.[0];
        if (!firstColumn) return;

        router.patch(
            route("tasks.move", [team.slug, board.slug, task.slug]),
            { board_id: newBoardId, column_id: firstColumn.id, sort_order: 0 },
            { preserveScroll: true },
        );
    };

    const handleToggleComplete = () => {
        router.patch(
            route("tasks.toggle-complete", [team.slug, board.slug, task.slug]),
            {},
            { preserveScroll: true },
        );
    };

    const handleToggleWatch = () => {
        router.patch(
            route("tasks.toggle-watch", [team.slug, board.slug, task.slug]),
            {},
            { preserveScroll: true },
        );
    };

    const handleDueDateChange = (newDate: string) => {
        setDueDate(newDate);
        if (dueDateTimeoutRef.current) clearTimeout(dueDateTimeoutRef.current);
        dueDateTimeoutRef.current = setTimeout(() => {
            dueDateTimeoutRef.current = null;
            saveField({ due_date: newDate || null });
        }, 600);
    };

    const handleEffortChange = (value: string) => {
        setEffortEstimate(value);
        if (effortTimeoutRef.current) clearTimeout(effortTimeoutRef.current);
        effortTimeoutRef.current = setTimeout(() => {
            effortTimeoutRef.current = null;
            const num = parseInt(value);
            saveField({ effort_estimate: isNaN(num) ? null : num });
        }, 600);
    };

    const handleRecurrenceChange = (config: RecurrenceConfigType | null) => {
        setRecurrenceConfig(config);
        if (recurrenceTimeoutRef.current)
            clearTimeout(recurrenceTimeoutRef.current);
        recurrenceTimeoutRef.current = setTimeout(() => {
            recurrenceTimeoutRef.current = null;
            saveField({ recurrence_config: config });
        }, 600);
    };

    const handleDelete = () => {
        router.delete(
            route("tasks.destroy", [team.slug, board.slug, task.slug]),
            {
                onSuccess: () =>
                    router.visit(
                        route("teams.boards.show", [team.slug, board.slug]),
                    ),
            },
        );
    };

    const handleSaveAsTemplate = () => {
        if (!templateName.trim()) return;
        router.post(
            route("tasks.save-template", [team.slug, board.slug, task.slug]),
            { name: templateName.trim() },
            {
                preserveScroll: true,
                onSuccess: () => {
                    setTemplateDialogOpen(false);
                    setTemplateName("");
                },
            },
        );
    };

    // Micro-label above each sidebar field group.
    const microLabel = (label: string) => (
        <Typography
            component="span"
            sx={{
                display: "block",
                fontSize: 10.5,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.07em",
                color: harbor.faint,
                mb: "6px",
            }}
        >
            {label}
        </Typography>
    );

    const fieldRow = (label: string, children: React.ReactNode) => (
        <Box>
            {microLabel(label)}
            <Box>{children}</Box>
        </Box>
    );

    return (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1.75 }}>
            {/* Actions — complete / watch / board / column */}
            <Box sx={{ ...groupCardSx, gap: 1.125 }}>
                <Button
                    variant="contained"
                    color={isCompleted ? "success" : "primary"}
                    disableElevation
                    startIcon={
                        isCompleted ? (
                            <CheckCircleOutlineIcon sx={{ fontSize: 16 }} />
                        ) : (
                            <CheckIcon sx={{ fontSize: 16 }} />
                        )
                    }
                    onClick={handleToggleComplete}
                    fullWidth
                    aria-label={
                        isCompleted ? "Mark incomplete" : "Mark complete"
                    }
                    sx={{
                        height: 38,
                        borderRadius: "10px",
                        fontSize: 13,
                        fontWeight: 700,
                    }}
                >
                    {isCompleted ? "Completed" : "Mark Complete"}
                </Button>

                <Button
                    startIcon={
                        isWatching ? (
                            <VisibilityIcon sx={{ fontSize: 16 }} />
                        ) : (
                            <VisibilityOffIcon sx={{ fontSize: 16 }} />
                        )
                    }
                    onClick={handleToggleWatch}
                    fullWidth
                    aria-label={isWatching ? "Unwatch task" : "Watch task"}
                    sx={{
                        height: 38,
                        borderRadius: "10px",
                        fontSize: 13,
                        fontWeight: 700,
                        bgcolor: harbor.countBg,
                        color: isWatching ? harborHex.accent : harbor.ink,
                        transition: "background-color 150ms ease-out",
                        "&:hover": { bgcolor: harbor.track },
                    }}
                >
                    {isWatching ? "Watching" : "Watch"}
                </Button>

                {/* Board selector */}
                {teamBoards.length > 1 && (
                    <Select
                        size="small"
                        fullWidth
                        value={board.id}
                        onChange={(e) => handleBoardChange(e.target.value)}
                        inputProps={{ "aria-label": "Board" }}
                        sx={controlSx}
                        renderValue={(value) => {
                            const b = teamBoards.find((tb) => tb.id === value);
                            return (
                                <Box
                                    sx={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 1,
                                    }}
                                >
                                    <DashboardIcon
                                        sx={{
                                            fontSize: 14,
                                            color: harbor.faint,
                                        }}
                                    />
                                    {b?.name ?? "Unknown"}
                                </Box>
                            );
                        }}
                    >
                        {teamBoards.map((b) => (
                            <MenuItem key={b.id} value={b.id}>
                                <Box
                                    sx={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 1,
                                    }}
                                >
                                    <DashboardIcon
                                        sx={{
                                            fontSize: 14,
                                            color: "text.secondary",
                                        }}
                                    />
                                    {b.name}
                                </Box>
                            </MenuItem>
                        ))}
                    </Select>
                )}

                {/* Column selector — 8px status dot in the column color */}
                <Select
                    size="small"
                    fullWidth
                    value={task.column_id}
                    onChange={(e) => handleColumnChange(e.target.value)}
                    inputProps={{ "aria-label": "Column" }}
                    sx={controlSx}
                    renderValue={(value) => {
                        const col = columns.find((c) => c.id === value);
                        return (
                            <Box
                                sx={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 1,
                                }}
                            >
                                <Box
                                    sx={{
                                        width: 8,
                                        height: 8,
                                        borderRadius: "50%",
                                        bgcolor: col?.color ?? "grey.400",
                                        flexShrink: 0,
                                    }}
                                />
                                {col?.name ?? "Unknown"}
                            </Box>
                        );
                    }}
                >
                    {columns.map((col) => (
                        <MenuItem key={col.id} value={col.id}>
                            <Box
                                sx={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 1,
                                }}
                            >
                                <Box
                                    sx={{
                                        width: 8,
                                        height: 8,
                                        borderRadius: "50%",
                                        bgcolor: col.color,
                                        flexShrink: 0,
                                    }}
                                />
                                {col.name}
                            </Box>
                        </MenuItem>
                    ))}
                </Select>
            </Box>

            {/* GitLab */}
            {gitlabProjects.length > 0 && (
                <Box sx={{ ...groupCardSx, gap: 1.125 }}>
                    {microLabel("GitLab")}
                    <GitlabSidebarControls
                        task={task}
                        teamSlug={team.slug}
                        boardSlug={board.slug}
                        gitlabProjects={gitlabProjects}
                    />
                </Box>
            )}

            {/* Details */}
            <Box sx={{ ...groupCardSx, gap: 1.5 }}>
                {fieldRow(
                    "Priority",
                    <PrioritySelector
                        task={task}
                        teamSlug={team.slug}
                        boardSlug={board.slug}
                    />,
                )}
                {fieldRow(
                    "Assignees",
                    <AssigneeSelector
                        task={task}
                        members={members}
                        teamSlug={team.slug}
                        boardSlug={board.slug}
                    />,
                )}
                {fieldRow(
                    "Labels",
                    <LabelSelector
                        task={task}
                        labels={labels}
                        teamSlug={team.slug}
                        boardSlug={board.slug}
                    />,
                )}
                {fieldRow(
                    "Due date",
                    <TextField
                        type="date"
                        size="small"
                        fullWidth
                        value={dueDate}
                        onChange={(e) => handleDueDateChange(e.target.value)}
                        sx={{ "& .MuiOutlinedInput-root": controlSx }}
                        slotProps={{
                            htmlInput: {
                                "aria-label": "Due date",
                            },
                            input: {
                                startAdornment: (
                                    <CalendarTodayIcon
                                        sx={{
                                            fontSize: 15,
                                            mr: 1,
                                            color: harbor.faint,
                                        }}
                                    />
                                ),
                            },
                            inputLabel: { shrink: true },
                        }}
                    />,
                )}
                {fieldRow(
                    "Effort",
                    <TextField
                        type="number"
                        size="small"
                        fullWidth
                        value={effortEstimate}
                        onChange={(e) => handleEffortChange(e.target.value)}
                        placeholder="Points"
                        sx={{ "& .MuiOutlinedInput-root": controlSx }}
                        slotProps={{
                            htmlInput: {
                                min: 0,
                                "aria-label": "Effort points",
                            },
                        }}
                    />,
                )}
            </Box>

            {/* Planning — dependencies + recurrence */}
            <Box sx={{ ...groupCardSx, gap: 1.375 }}>
                <DependencySection
                    task={task}
                    boardTasks={boardTasks}
                    teamSlug={team.slug}
                    boardSlug={board.slug}
                />

                <Box
                    sx={{
                        borderTop: `1px solid ${harbor.cardBorder}`,
                        pt: 1.375,
                    }}
                >
                    <RecurrenceConfig
                        config={recurrenceConfig}
                        onChange={handleRecurrenceChange}
                    />
                </Box>
            </Box>

            {/* Info */}
            <Box sx={{ ...groupCardSx, gap: 0.875 }}>
                {microLabel("Info")}
                <Box sx={{ display: "flex", fontSize: 12, color: harbor.sub }}>
                    <Box
                        component="span"
                        sx={{ width: 70, flexShrink: 0, color: harbor.faint }}
                    >
                        Created
                    </Box>
                    <Box component="span">
                        {formatTimestamp(task.created_at)}
                        {task.creator && ` by ${task.creator.name}`}
                    </Box>
                </Box>
                <Box sx={{ display: "flex", fontSize: 12, color: harbor.sub }}>
                    <Box
                        component="span"
                        sx={{ width: 70, flexShrink: 0, color: harbor.faint }}
                    >
                        Updated
                    </Box>
                    <Box component="span">
                        {formatTimestamp(task.updated_at)}
                    </Box>
                </Box>

                {/* Actions — template / delete */}
                <Box
                    sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 1.75,
                        borderTop: `1px solid ${harbor.cardBorder}`,
                        pt: 1.25,
                        mt: 0.375,
                    }}
                >
                    {canManageTemplates && (
                        <Button
                            variant="text"
                            startIcon={
                                <ContentCopyIcon
                                    sx={{ fontSize: "13px !important" }}
                                />
                            }
                            onClick={() => setTemplateDialogOpen(true)}
                            size="small"
                            sx={{
                                px: 0.5,
                                minWidth: 0,
                                fontSize: 12.5,
                                fontWeight: 700,
                                color: harbor.sub,
                                "&:hover": {
                                    bgcolor: "transparent",
                                    color: harbor.ink,
                                },
                            }}
                        >
                            Template
                        </Button>
                    )}
                    <Box sx={{ flex: 1 }} />
                    <Button
                        variant="text"
                        startIcon={
                            <DeleteIcon sx={{ fontSize: "13px !important" }} />
                        }
                        onClick={() => setDeleteDialogOpen(true)}
                        size="small"
                        sx={{
                            px: 0.5,
                            minWidth: 0,
                            fontSize: 12.5,
                            fontWeight: 700,
                            color: harbor.dangerText,
                            "&:hover": {
                                bgcolor: "transparent",
                                color: harborHex.danger,
                            },
                        }}
                    >
                        Delete
                    </Button>
                </Box>
            </Box>

            {/* Delete confirmation dialog */}
            <ConfirmDialog
                open={deleteDialogOpen}
                onClose={() => setDeleteDialogOpen(false)}
                onConfirm={handleDelete}
                title="Delete Task"
                message={`Are you sure you want to delete "${task.title}"? This will also delete all subtasks, comments, and attachments. This action cannot be undone.`}
                confirmLabel="Delete"
                confirmColor="error"
            />

            {/* Save as template dialog */}
            <Dialog
                open={canManageTemplates && templateDialogOpen}
                onClose={() => setTemplateDialogOpen(false)}
                maxWidth="xs"
                fullWidth
                aria-labelledby="save-template-dialog-title"
            >
                <DialogTitle id="save-template-dialog-title">
                    Save as Template
                </DialogTitle>
                <DialogContent>
                    <TextField
                        autoFocus
                        fullWidth
                        label="Template name"
                        value={templateName}
                        onChange={(e) => setTemplateName(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") handleSaveAsTemplate();
                        }}
                        sx={{ mt: 1 }}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setTemplateDialogOpen(false)}>
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSaveAsTemplate}
                        variant="contained"
                        disabled={!templateName.trim()}
                    >
                        Save
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
