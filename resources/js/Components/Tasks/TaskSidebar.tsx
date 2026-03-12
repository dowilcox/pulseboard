import GitlabSidebarControls from "@/Components/Gitlab/GitlabSidebarControls";
import AssigneeSelector from "@/Components/Tasks/AssigneeSelector";
import DependencySection from "@/Components/Tasks/DependencySection";
import LabelSelector from "@/Components/Tasks/LabelSelector";
import PrioritySelector from "@/Components/Tasks/PrioritySelector";
import RecurrenceConfig from "@/Components/Tasks/RecurrenceConfig";
import type {
    Board,
    GitlabProject,
    Label,
    RecurrenceConfig as RecurrenceConfigType,
    Task,
    TaskSummary,
    User,
} from "@/types";
import type { RequestPayload } from "@inertiajs/core";
import { router } from "@inertiajs/react";
import BookmarkAddIcon from "@mui/icons-material/BookmarkAdd";
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import DashboardIcon from "@mui/icons-material/Dashboard";
import DeleteIcon from "@mui/icons-material/Delete";
import RadioButtonUncheckedIcon from "@mui/icons-material/RadioButtonUnchecked";
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
import { useCallback, useRef, useState } from "react";

interface Props {
    task: Task;
    team: { id: string; name: string; slug: string };
    board: Board;
    members: User[];
    labels: Label[];
    boardTasks: TaskSummary[];
    teamBoards: Board[];
    gitlabProjects?: GitlabProject[];
}

function formatTimestamp(ts: string): string {
    const date = new Date(ts);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
}

export default function TaskSidebar({
    task,
    team,
    board,
    members,
    labels,
    boardTasks,
    teamBoards,
    gitlabProjects = [],
}: Props) {
    const columns = board.columns ?? [];
    const isCompleted =
        task.completed_at !== null && task.completed_at !== undefined;

    const [dueDate, setDueDate] = useState(task.due_date ?? "");
    const [effortEstimate, setEffortEstimate] = useState<string>(
        task.effort_estimate != null ? String(task.effort_estimate) : "",
    );
    const [recurrenceConfig, setRecurrenceConfig] =
        useState<RecurrenceConfigType | null>(task.recurrence_config ?? null);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
    const [templateName, setTemplateName] = useState("");

    const effortTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const recurrenceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
        null,
    );

    const saveField = useCallback(
        (data: Record<string, unknown>) => {
            router.put(
                route("tasks.update", [team.id, board.id, task.id]),
                data as RequestPayload,
                {
                    preserveScroll: true,
                    preserveState: true,
                },
            );
        },
        [team.id, board.id, task.id],
    );

    const handleColumnChange = (columnId: string) => {
        router.patch(
            route("tasks.move", [team.id, board.id, task.id]),
            { column_id: columnId, sort_order: 0 },
            { preserveScroll: true },
        );
    };

    const handleBoardChange = (newBoardId: string) => {
        if (newBoardId === board.id) return;
        const targetBoard = teamBoards.find((b) => b.id === newBoardId);
        const firstColumn = targetBoard?.columns?.[0];
        if (!firstColumn) return;

        router.patch(
            route("tasks.move", [team.id, board.id, task.id]),
            { board_id: newBoardId, column_id: firstColumn.id, sort_order: 0 },
            { preserveScroll: true },
        );
    };

    const handleToggleComplete = () => {
        router.patch(
            route("tasks.toggle-complete", [team.id, board.id, task.id]),
            {},
            { preserveScroll: true },
        );
    };

    const handleDueDateChange = (newDate: string) => {
        setDueDate(newDate);
        saveField({ due_date: newDate || null });
    };

    const handleEffortChange = (value: string) => {
        setEffortEstimate(value);
        if (effortTimeoutRef.current) clearTimeout(effortTimeoutRef.current);
        effortTimeoutRef.current = setTimeout(() => {
            const num = parseInt(value);
            saveField({ effort_estimate: isNaN(num) ? null : num });
        }, 600);
    };

    const handleRecurrenceChange = (config: RecurrenceConfigType | null) => {
        setRecurrenceConfig(config);
        if (recurrenceTimeoutRef.current)
            clearTimeout(recurrenceTimeoutRef.current);
        recurrenceTimeoutRef.current = setTimeout(
            () => saveField({ recurrence_config: config }),
            600,
        );
    };

    const handleDelete = () => {
        router.delete(route("tasks.destroy", [team.id, board.id, task.id]), {
            onSuccess: () =>
                router.visit(route("teams.boards.show", [team.id, board.id])),
        });
    };

    const handleSaveAsTemplate = () => {
        if (!templateName.trim()) return;
        router.post(
            route("tasks.save-template", [team.id, board.id, task.id]),
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

    const sectionLabel = (label: string) => (
        <Typography
            variant="caption"
            fontWeight={700}
            color="text.secondary"
            textTransform="uppercase"
            letterSpacing={0.5}
            sx={{ pt: 0.5 }}
        >
            {label}
        </Typography>
    );

    const fieldRow = (label: string, children: React.ReactNode) => (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
            <Typography
                variant="caption"
                color="text.secondary"
                fontWeight={600}
            >
                {label}
            </Typography>
            <Box>{children}</Box>
        </Box>
    );

    return (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
            {/* Status — always visible */}
            <Button
                variant={isCompleted ? "contained" : "outlined"}
                color={isCompleted ? "success" : "inherit"}
                startIcon={
                    isCompleted ? (
                        <CheckCircleOutlineIcon />
                    ) : (
                        <RadioButtonUncheckedIcon />
                    )
                }
                onClick={handleToggleComplete}
                fullWidth
                size="small"
                aria-label={isCompleted ? "Mark incomplete" : "Mark complete"}
            >
                {isCompleted ? "Completed" : "Mark Complete"}
            </Button>

            {/* Board selector */}
            {teamBoards.length > 1 && (
                <Select
                    size="small"
                    fullWidth
                    value={board.id}
                    onChange={(e) => handleBoardChange(e.target.value)}
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
                                        color: "text.secondary",
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

            {/* Column selector */}
            <Select
                size="small"
                fullWidth
                value={task.column_id}
                onChange={(e) => handleColumnChange(e.target.value)}
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
                                    width: 10,
                                    height: 10,
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
                                    width: 10,
                                    height: 10,
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

            {/* GitLab */}
            {gitlabProjects.length > 0 && (
                <>
                    {sectionLabel("GitLab")}
                    <GitlabSidebarControls
                        task={task}
                        teamId={team.id}
                        boardId={board.id}
                        gitlabProjects={gitlabProjects}
                    />
                </>
            )}

            {/* Details */}
            {sectionLabel("Details")}
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
                {fieldRow(
                    "Priority",
                    <PrioritySelector
                        task={task}
                        teamId={team.id}
                        boardId={board.id}
                    />,
                )}
                {fieldRow(
                    "Assignees",
                    <AssigneeSelector
                        task={task}
                        members={members}
                        teamId={team.id}
                        boardId={board.id}
                    />,
                )}
                {fieldRow(
                    "Labels",
                    <LabelSelector
                        task={task}
                        labels={labels}
                        teamId={team.id}
                        boardId={board.id}
                    />,
                )}
                {fieldRow(
                    "Due Date",
                    <TextField
                        type="date"
                        size="small"
                        fullWidth
                        value={dueDate}
                        onChange={(e) => handleDueDateChange(e.target.value)}
                        slotProps={{
                            input: {
                                startAdornment: (
                                    <CalendarTodayIcon
                                        sx={{
                                            fontSize: 16,
                                            mr: 1,
                                            color: "text.secondary",
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
                        slotProps={{ htmlInput: { min: 0 } }}
                    />,
                )}
            </Box>

            {/* Planning */}
            {sectionLabel("Planning")}
            <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <DependencySection
                    task={task}
                    boardTasks={boardTasks}
                    teamId={team.id}
                    boardId={board.id}
                />

                {fieldRow(
                    "Recurrence",
                    <RecurrenceConfig
                        config={recurrenceConfig}
                        onChange={handleRecurrenceChange}
                    />,
                )}
            </Box>

            {/* Info */}
            {sectionLabel("Info")}
            <Box
                sx={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 0.25,
                }}
            >
                <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                    <Typography variant="caption" color="text.disabled">
                        Created
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                        {formatTimestamp(task.created_at)}
                        {task.creator && ` by ${task.creator.name}`}
                    </Typography>
                </Box>
                <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                    <Typography variant="caption" color="text.disabled">
                        Updated
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                        {formatTimestamp(task.updated_at)}
                    </Typography>
                </Box>
            </Box>

            {/* Actions */}
            <Box
                sx={{
                    display: "flex",
                    gap: 1,
                    pt: 0.5,
                    borderTop: 1,
                    borderColor: "divider",
                    mt: 0.5,
                }}
            >
                <Button
                    variant="text"
                    startIcon={
                        <BookmarkAddIcon sx={{ fontSize: "16px !important" }} />
                    }
                    onClick={() => setTemplateDialogOpen(true)}
                    size="small"
                    sx={{
                        flex: 1,
                        textTransform: "none",
                        color: "text.secondary",
                        fontSize: "0.75rem",
                        "&:hover": {
                            color: "text.primary",
                            bgcolor: "action.hover",
                        },
                    }}
                >
                    Template
                </Button>
                <Button
                    variant="text"
                    startIcon={
                        <DeleteIcon sx={{ fontSize: "16px !important" }} />
                    }
                    onClick={() => setDeleteDialogOpen(true)}
                    size="small"
                    sx={{
                        flex: 1,
                        textTransform: "none",
                        color: "text.secondary",
                        fontSize: "0.75rem",
                        "&:hover": {
                            color: "error.main",
                            bgcolor: "action.hover",
                        },
                    }}
                >
                    Delete
                </Button>
            </Box>

            {/* Delete confirmation dialog */}
            <Dialog
                open={deleteDialogOpen}
                onClose={() => setDeleteDialogOpen(false)}
                aria-labelledby="delete-task-dialog-title"
            >
                <DialogTitle id="delete-task-dialog-title">
                    Delete Task
                </DialogTitle>
                <DialogContent>
                    <Typography>
                        Are you sure you want to delete "{task.title}"? This
                        will also delete all subtasks, comments, and
                        attachments. This action cannot be undone.
                    </Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDeleteDialogOpen(false)}>
                        Cancel
                    </Button>
                    <Button
                        onClick={handleDelete}
                        color="error"
                        variant="contained"
                    >
                        Delete
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Save as template dialog */}
            <Dialog
                open={templateDialogOpen}
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
