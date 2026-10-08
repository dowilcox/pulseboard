import ConfirmDialog from "@/Components/Common/ConfirmDialog";
import GitlabSidebarControls from "@/Components/Gitlab/GitlabSidebarControls";
import AssigneeSelector from "@/Components/Tasks/AssigneeSelector";
import DependencySection from "@/Components/Tasks/DependencySection";
import LabelSelector from "@/Components/Tasks/LabelSelector";
import PrioritySelector from "@/Components/Tasks/PrioritySelector";
import RecurrenceConfig from "@/Components/Tasks/RecurrenceConfig";
import { useSnackbar } from "@/Contexts/SnackbarContext";
import type { Autosave } from "@/hooks/useAutosave";
import { harbor, harborHex } from "@/theme/harbor";
import { formatTimestamp } from "@/utils/formatTimestamp";
import {
    dueDateHint,
    parseEffortInput,
    toDateInputValue,
} from "@/utils/taskFields";
import type {
    Board,
    GitlabProject,
    Label,
    RecurrenceConfig as RecurrenceConfigType,
    Task,
    TaskMoveTarget,
    TaskPermissions,
    TaskSummary,
    User,
} from "@/types";
import { router } from "@inertiajs/react";
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
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { type ReactNode, useEffect, useId, useState } from "react";

interface Props {
    task: Task;
    team: { id: string; name: string; slug: string };
    board: Board;
    members: User[];
    labels: Label[];
    /** Dependency candidates (this board plus open tasks on other boards). */
    boardTasks: TaskSummary[];
    /** Other boards the user may move this task to, with their columns. */
    moveTargets: TaskMoveTarget[];
    can: TaskPermissions;
    gitlabProjects?: GitlabProject[];
    isWatching: boolean;
    autosave: Autosave;
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

/** Debounce for sidebar fields saved through the page autosave. */
const FIELD_SAVE_DELAY = 600;

type MoveColumn = TaskMoveTarget["columns"][number];

/** WIP limits of 0/null don't restrict (mirrors MoveTask::assertWipCapacity). */
function isColumnFull(column: MoveColumn): boolean {
    return (
        !!column.wip_limit &&
        column.wip_limit > 0 &&
        (column.tasks_count ?? 0) >= column.wip_limit
    );
}

function ColumnDot({ color }: { color?: string }) {
    return (
        <Box
            aria-hidden
            sx={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                bgcolor: color ?? "grey.400",
                flexShrink: 0,
            }}
        />
    );
}

interface MoveTaskDialogProps {
    open: boolean;
    targets: TaskMoveTarget[];
    initialBoardId: string;
    taskLabel: string;
    submitting: boolean;
    onClose: () => void;
    onConfirm: (boardId: string, columnId: string) => void;
}

/** Pick the destination board + column for a cross-board move. */
function MoveTaskDialog({
    open,
    targets,
    initialBoardId,
    taskLabel,
    submitting,
    onClose,
    onConfirm,
}: MoveTaskDialogProps) {
    const titleId = useId();
    const [boardId, setBoardId] = useState(initialBoardId);
    const [columnId, setColumnId] = useState("");

    useEffect(() => {
        if (open) setBoardId(initialBoardId);
    }, [open, initialBoardId]);

    const target = targets.find((t) => t.id === boardId);

    // Default to the first open, non-done column with room whenever the
    // dialog opens or the board changes.
    useEffect(() => {
        if (!open) return;
        const columns = targets.find((t) => t.id === boardId)?.columns ?? [];
        const preferred =
            columns.find((c) => !c.is_done_column && !isColumnFull(c)) ??
            columns.find((c) => !isColumnFull(c));
        setColumnId(preferred?.id ?? "");
        // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only on open/board change
    }, [open, boardId]);

    return (
        <Dialog
            open={open}
            onClose={submitting ? undefined : onClose}
            maxWidth="xs"
            fullWidth
            aria-labelledby={titleId}
        >
            <DialogTitle id={titleId}>Move to another board</DialogTitle>
            <DialogContent>
                <DialogContentText sx={{ mb: 2 }}>
                    {taskLabel} will move with its comments, checklists and
                    attachments, and gets a new number on the target board.
                </DialogContentText>
                <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    <TextField
                        select
                        fullWidth
                        label="Board"
                        value={boardId}
                        onChange={(e) => setBoardId(e.target.value)}
                    >
                        {targets.map((t) => (
                            <MenuItem key={t.id} value={t.id}>
                                {t.name}
                            </MenuItem>
                        ))}
                    </TextField>
                    <TextField
                        select
                        fullWidth
                        label="Column"
                        value={columnId}
                        onChange={(e) => setColumnId(e.target.value)}
                        helperText={
                            target && target.columns.length === 0
                                ? "This board has no columns yet."
                                : undefined
                        }
                    >
                        {(target?.columns ?? []).map((column) => {
                            const full = isColumnFull(column);
                            return (
                                <MenuItem
                                    key={column.id}
                                    value={column.id}
                                    disabled={full}
                                >
                                    <Box
                                        sx={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 1,
                                        }}
                                    >
                                        <ColumnDot color={column.color} />
                                        {column.name}
                                        {full && " (WIP limit reached)"}
                                    </Box>
                                </MenuItem>
                            );
                        })}
                    </TextField>
                </Box>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} disabled={submitting}>
                    Cancel
                </Button>
                <Button
                    variant="contained"
                    disableElevation
                    disabled={!columnId || submitting}
                    onClick={() => onConfirm(boardId, columnId)}
                >
                    {submitting ? "Moving…" : "Move task"}
                </Button>
            </DialogActions>
        </Dialog>
    );
}

export default function TaskSidebar({
    task,
    team,
    board,
    members,
    labels,
    boardTasks,
    moveTargets,
    can,
    gitlabProjects = [],
    isWatching,
    autosave,
}: Props) {
    const { showSnackbar } = useSnackbar();

    const columns = board.columns ?? [];
    const isCompleted = task.completed_at != null;
    const taskLabel = task.task_number
        ? `#${task.task_number} ${task.title}`
        : task.title;

    const [dueDate, setDueDate] = useState(toDateInputValue(task.due_date));
    const [effortEstimate, setEffortEstimate] = useState<string>(
        task.effort_estimate != null ? String(task.effort_estimate) : "",
    );
    const [recurrenceConfig, setRecurrenceConfig] =
        useState<RecurrenceConfigType | null>(task.recurrence_config ?? null);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
    const [templateName, setTemplateName] = useState("");
    const [savingTemplate, setSavingTemplate] = useState(false);
    const [moveBoardId, setMoveBoardId] = useState<string | null>(null);
    const [moving, setMoving] = useState(false);

    // Take server values unless the field has an unsaved local edit.
    useEffect(() => {
        if (!autosave.isBusy("due_date")) {
            setDueDate(toDateInputValue(task.due_date));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps -- sync on prop change only
    }, [task.due_date]);

    useEffect(() => {
        if (!autosave.isBusy("effort_estimate")) {
            setEffortEstimate(
                task.effort_estimate != null
                    ? String(task.effort_estimate)
                    : "",
            );
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps -- sync on prop change only
    }, [task.effort_estimate]);

    useEffect(() => {
        if (!autosave.isBusy("recurrence_config")) {
            setRecurrenceConfig(task.recurrence_config ?? null);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps -- sync on prop change only
    }, [task.recurrence_config]);

    const handleColumnChange = (columnId: string) => {
        if (columnId === task.column_id) return;
        router.patch(
            route("tasks.move", [team.slug, board.slug, task.slug]),
            // null lets the server append after the column's last task
            { column_id: columnId, sort_order: null },
            { preserveScroll: true },
        );
    };

    const handleMoveConfirm = (boardId: string, columnId: string) => {
        setMoving(true);
        const move = () =>
            router.patch(
                route("tasks.move", [team.slug, board.slug, task.slug]),
                { board_id: boardId, column_id: columnId, sort_order: null },
                {
                    // The server redirects to the task's new URL and flashes
                    // a success message.
                    onSuccess: () => setMoveBoardId(null),
                    onFinish: () => setMoving(false),
                },
            );
        // Land pending edits on the current URL before the task moves.
        autosave.flush().then(move, move);
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
        autosave.schedule("due_date", newDate || null, FIELD_SAVE_DELAY);
    };

    const handleEffortChange = (value: string) => {
        const { text, points } = parseEffortInput(value);
        setEffortEstimate(text);
        autosave.schedule("effort_estimate", points, FIELD_SAVE_DELAY);
    };

    const handleRecurrenceChange = (config: RecurrenceConfigType | null) => {
        setRecurrenceConfig(config);
        autosave.schedule("recurrence_config", config, FIELD_SAVE_DELAY);
    };

    const handleDelete = () => {
        setDeleteDialogOpen(false);
        // Unsaved edits to a task being deleted are moot.
        autosave.discard();
        // The server redirects back to the board.
        router.delete(
            route("tasks.destroy", [team.slug, board.slug, task.slug]),
        );
    };

    const handleSaveAsTemplate = () => {
        const name = templateName.trim();
        if (!name || savingTemplate) return;
        setSavingTemplate(true);
        const save = () =>
            router.post(
                route("tasks.save-template", [
                    team.slug,
                    board.slug,
                    task.slug,
                ]),
                { name },
                {
                    preserveScroll: true,
                    onSuccess: () => {
                        setTemplateDialogOpen(false);
                        setTemplateName("");
                        showSnackbar(
                            `Saved “${name}” as a task template.`,
                            "success",
                        );
                    },
                    onFinish: () => setSavingTemplate(false),
                },
            );
        // The template is built from the stored task, so save edits first.
        autosave.flush().then(save, save);
    };

    // Micro-label above each sidebar field group.
    const microLabel = (label: string, htmlFor?: string) => (
        <Typography
            component={htmlFor ? "label" : "span"}
            htmlFor={htmlFor}
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

    const fieldRow = (label: string, children: ReactNode, htmlFor?: string) => (
        <Box>
            {microLabel(label, htmlFor)}
            <Box>{children}</Box>
        </Box>
    );

    const dueHint = dueDateHint(dueDate, isCompleted);
    const dueDateId = `task-${task.id}-due-date`;
    const effortId = `task-${task.id}-effort`;
    const moveOptions = [{ id: board.id, name: board.name }, ...moveTargets];

    return (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1.75 }}>
            {/* Actions — complete / watch / board / column */}
            <Box sx={{ ...groupCardSx, gap: 1.125 }}>
                {/* Visible text is the accessible name (WCAG 2.5.3). */}
                <Button
                    variant="contained"
                    color={isCompleted ? "success" : "primary"}
                    disableElevation
                    disabled={!can.update}
                    startIcon={
                        isCompleted ? (
                            <CheckCircleOutlineIcon sx={{ fontSize: 16 }} />
                        ) : (
                            <CheckIcon sx={{ fontSize: 16 }} />
                        )
                    }
                    onClick={handleToggleComplete}
                    fullWidth
                    sx={{
                        height: 38,
                        borderRadius: "10px",
                        fontSize: 13,
                        fontWeight: 700,
                    }}
                >
                    {isCompleted ? "Completed — Reopen" : "Mark complete"}
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
                    aria-pressed={isWatching}
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

                {/* Board selector — only when there's somewhere to move to */}
                {can.move && moveTargets.length > 0 && (
                    <Select
                        size="small"
                        fullWidth
                        value={board.id}
                        onChange={(e) => {
                            if (e.target.value !== board.id) {
                                setMoveBoardId(e.target.value);
                            }
                        }}
                        inputProps={{ "aria-label": "Board" }}
                        sx={controlSx}
                        renderValue={(value) => (
                            <Box
                                sx={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 1,
                                }}
                            >
                                <DashboardIcon
                                    sx={{ fontSize: 14, color: harbor.faint }}
                                />
                                {moveOptions.find((b) => b.id === value)
                                    ?.name ?? "Unknown"}
                            </Box>
                        )}
                    >
                        {moveOptions.map((b) => (
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
                                    {b.id === board.id
                                        ? b.name
                                        : `Move to ${b.name}…`}
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
                    disabled={!can.update}
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
                                <ColumnDot color={col?.color} />
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
                                <ColumnDot color={col.color} />
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
                        id={dueDateId}
                        type="date"
                        size="small"
                        fullWidth
                        value={dueDate}
                        onChange={(e) => handleDueDateChange(e.target.value)}
                        sx={{ "& .MuiOutlinedInput-root": controlSx }}
                        helperText={dueHint?.text}
                        slotProps={{
                            formHelperText: {
                                sx: {
                                    mx: 0,
                                    fontWeight: 700,
                                    color:
                                        dueHint?.tone === "overdue"
                                            ? harbor.dangerText
                                            : harbor.dueSoon.fg,
                                },
                            },
                        }}
                    />,
                    dueDateId,
                )}
                {fieldRow(
                    "Effort (points)",
                    <TextField
                        id={effortId}
                        size="small"
                        fullWidth
                        value={effortEstimate}
                        onChange={(e) => handleEffortChange(e.target.value)}
                        placeholder="e.g. 3"
                        sx={{ "& .MuiOutlinedInput-root": controlSx }}
                        slotProps={{
                            htmlInput: {
                                inputMode: "numeric",
                                pattern: "[0-9]*",
                                autoComplete: "off",
                            },
                        }}
                    />,
                    effortId,
                )}
            </Box>

            {/* Planning — dependencies + recurrence */}
            <Box sx={{ ...groupCardSx, gap: 1.375 }}>
                <DependencySection
                    task={task}
                    boardTasks={boardTasks}
                    teamSlug={team.slug}
                    board={board}
                    canEdit={can.update}
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
                {(can.saveAsTemplate || can.delete) && (
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
                        {can.saveAsTemplate && (
                            <Tooltip title="Create a reusable task template from this task's description, checklists, labels, priority and effort">
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
                                    Save as template
                                </Button>
                            </Tooltip>
                        )}
                        <Box sx={{ flex: 1 }} />
                        {can.delete && (
                            <Button
                                variant="text"
                                startIcon={
                                    <DeleteIcon
                                        sx={{ fontSize: "13px !important" }}
                                    />
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
                                Delete task
                            </Button>
                        )}
                    </Box>
                )}
            </Box>

            {/* Move to another board */}
            {can.move && moveTargets.length > 0 && (
                <MoveTaskDialog
                    open={moveBoardId !== null}
                    targets={moveTargets}
                    initialBoardId={moveBoardId ?? moveTargets[0].id}
                    taskLabel={`“${taskLabel}”`}
                    submitting={moving}
                    onClose={() => setMoveBoardId(null)}
                    onConfirm={handleMoveConfirm}
                />
            )}

            {/* Delete confirmation dialog */}
            {can.delete && (
                <ConfirmDialog
                    open={deleteDialogOpen}
                    onClose={() => setDeleteDialogOpen(false)}
                    onConfirm={handleDelete}
                    title="Delete task?"
                    message={`“${taskLabel}” and all of its subtasks, comments and attachments will be permanently deleted. This can't be undone.`}
                    confirmLabel="Delete task"
                    confirmColor="error"
                />
            )}

            {/* Save as template dialog */}
            {can.saveAsTemplate && (
                <Dialog
                    open={templateDialogOpen}
                    onClose={() => setTemplateDialogOpen(false)}
                    maxWidth="xs"
                    fullWidth
                    aria-labelledby="save-template-dialog-title"
                >
                    <DialogTitle id="save-template-dialog-title">
                        Save as template
                    </DialogTitle>
                    <DialogContent>
                        <DialogContentText sx={{ mb: 1 }}>
                            New tasks created from this template start with this
                            task's description, checklists, labels, priority and
                            effort.
                        </DialogContentText>
                        <TextField
                            autoFocus
                            fullWidth
                            label="Template name"
                            value={templateName}
                            onChange={(e) => setTemplateName(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                    e.preventDefault();
                                    handleSaveAsTemplate();
                                }
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
                            disabled={!templateName.trim() || savingTemplate}
                        >
                            Save template
                        </Button>
                    </DialogActions>
                </Dialog>
            )}
        </Box>
    );
}
