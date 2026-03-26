import AutomationRulesPanel from "@/Components/Automation/AutomationRulesPanel";
import BoardImageUpload from "@/Components/Boards/BoardImageUpload";
import ColorSwatchPicker from "@/Components/Common/ColorSwatchPicker";
import ConfirmDeleteDialog from "@/Components/Common/ConfirmDeleteDialog";
import PageHeader from "@/Components/Layout/PageHeader";
import AuthenticatedLayout from "@/Layouts/AuthenticatedLayout";
import { PRIORITY_OPTIONS, PRIORITY_COLORS } from "@/constants/priorities";
import { Head, useForm, router } from "@inertiajs/react";
import axios from "axios";
import { useEffect, useState } from "react";
import type { Board, Column, Label, TaskTemplate, Team, User } from "@/types";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import SaveIcon from "@mui/icons-material/Save";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Collapse from "@mui/material/Collapse";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Checkbox from "@mui/material/Checkbox";
import Divider from "@mui/material/Divider";
import FormControlLabel from "@mui/material/FormControlLabel";
import IconButton from "@mui/material/IconButton";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Snackbar from "@mui/material/Snackbar";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";

interface ColumnFormData {
    id?: string;
    name: string;
    color: string;
    wip_limit: number | "";
    is_done_column: boolean;
    _destroy?: boolean;
}

interface Props {
    board: Board;
    team: Team;
    members: User[];
    labels: Label[];
}

export default function BoardSettings({ board, team, members, labels }: Props) {
    const boardForm = useForm({
        name: board.name,
        description: board.description ?? "",
        default_task_template_id: board.default_task_template_id ?? "",
        settings: {
            auto_move_to_done: board.settings?.auto_move_to_done ?? false,
        },
    });

    const initialColumns: ColumnFormData[] = (board.columns ?? []).map(
        (col) => ({
            id: col.id,
            name: col.name,
            color: col.color,
            wip_limit: col.wip_limit ?? "",
            is_done_column: col.is_done_column,
        }),
    );

    const [columns, setColumns] = useState<ColumnFormData[]>(initialColumns);
    const [columnErrors, setColumnErrors] = useState<Record<string, string>>(
        {},
    );
    const [savingColumns, setSavingColumns] = useState(false);
    const [expandedColumn, setExpandedColumn] = useState<number | null>(null);
    const [savingTemplate, setSavingTemplate] = useState(false);
    const [templateSnackbar, setTemplateSnackbar] = useState<{
        open: boolean;
        message: string;
        severity: "success" | "error";
    }>({
        open: false,
        message: "",
        severity: "success",
    });

    // Task Templates state
    const [taskTemplates, setTaskTemplates] = useState<TaskTemplate[]>([]);
    const [loadingTemplates, setLoadingTemplates] = useState(true);
    const [showTemplateForm, setShowTemplateForm] = useState(false);
    const [templateFormData, setTemplateFormData] = useState({
        name: "",
        description_template: "",
        priority: "none" as TaskTemplate["priority"],
        effort_estimate: "" as number | "",
    });
    const [templateFormErrors, setTemplateFormErrors] = useState<
        Record<string, string>
    >({});
    const [savingTaskTemplate, setSavingTaskTemplate] = useState(false);

    // Delete board state
    const [deleteBoardOpen, setDeleteBoardOpen] = useState(false);
    const [deletingBoard, setDeletingBoard] = useState(false);

    const handleDeleteBoard = () => {
        setDeletingBoard(true);
        router.delete(route("teams.boards.destroy", [team.slug, board.slug]), {
            data: { confirmation: "DELETE" },
            onFinish: () => setDeletingBoard(false),
        });
    };

    // Fetch task templates on mount
    useEffect(() => {
        const controller = new AbortController();

        axios
            .get(route("teams.task-templates.index", team.slug), {
                signal: controller.signal,
            })
            .then(({ data }) => {
                setTaskTemplates(data as TaskTemplate[]);
                setLoadingTemplates(false);
            })
            .catch((err) => {
                if (!axios.isCancel(err)) {
                    setLoadingTemplates(false);
                }
            });

        return () => controller.abort();
    }, [team.id]);

    const handleDeleteTaskTemplate = (templateId: string) => {
        axios
            .delete(
                route("teams.task-templates.destroy", [team.slug, templateId]),
            )
            .then(() => {
                setTaskTemplates((prev) =>
                    prev.filter((t) => t.id !== templateId),
                );
            });
    };

    const handleCreateTaskTemplate = () => {
        if (!templateFormData.name.trim()) {
            setTemplateFormErrors({ name: "Name is required." });
            return;
        }

        setSavingTaskTemplate(true);
        setTemplateFormErrors({});

        router.post(
            route("teams.task-templates.store", team.slug),
            {
                name: templateFormData.name,
                description_template:
                    templateFormData.description_template || undefined,
                priority: templateFormData.priority,
                effort_estimate:
                    templateFormData.effort_estimate === ""
                        ? undefined
                        : Number(templateFormData.effort_estimate),
            },
            {
                preserveScroll: true,
                onSuccess: () => {
                    setSavingTaskTemplate(false);
                    setShowTemplateForm(false);
                    setTemplateFormData({
                        name: "",
                        description_template: "",
                        priority: "none",
                        effort_estimate: "",
                    });
                    // Re-fetch templates after creation
                    axios
                        .get(route("teams.task-templates.index", team.slug))
                        .then(({ data }) =>
                            setTaskTemplates(data as TaskTemplate[]),
                        );
                },
                onError: (errors) => {
                    setTemplateFormErrors(errors as Record<string, string>);
                    setSavingTaskTemplate(false);
                },
            },
        );
    };

    const handleSaveAsTemplate = () => {
        setSavingTemplate(true);
        router.post(
            route("boards.create-template", [team.slug, board.slug]),
            {},
            {
                onSuccess: () => {
                    setSavingTemplate(false);
                    setTemplateSnackbar({
                        open: true,
                        message: "Board saved as template successfully.",
                        severity: "success",
                    });
                },
                onError: () => {
                    setSavingTemplate(false);
                    setTemplateSnackbar({
                        open: true,
                        message: "Failed to save board as template.",
                        severity: "error",
                    });
                },
            },
        );
    };

    const handleBoardSave = (e: React.FormEvent) => {
        e.preventDefault();
        boardForm.put(route("teams.boards.update", [team.slug, board.slug]));
    };

    const handleAddColumn = () => {
        setColumns((prev) => [
            ...prev,
            {
                name: "",
                color: "#64748b",
                wip_limit: "",
                is_done_column: false,
            },
        ]);
    };

    const handleColumnChange = (
        index: number,
        field: keyof ColumnFormData,
        value: string | number | boolean | "",
    ) => {
        setColumns((prev) =>
            prev.map((col, i) => {
                if (i === index) {
                    return { ...col, [field]: value };
                }
                if (field === "is_done_column" && value === true) {
                    return { ...col, is_done_column: false };
                }
                return col;
            }),
        );
    };

    const handleRemoveColumn = (index: number) => {
        setColumns((prev) => {
            const col = prev[index];
            if (col.id) {
                // Mark existing column for deletion
                return prev.map((c, i) =>
                    i === index ? { ...c, _destroy: true } : c,
                );
            }
            // Remove new unsaved column
            return prev.filter((_, i) => i !== index);
        });
    };

    const handleMoveColumn = (index: number, direction: "up" | "down") => {
        setColumns((prev) => {
            const next = [...prev];
            // Find the actual visible indices (skip _destroy items)
            const visibleIndices = next.reduce<number[]>((acc, col, i) => {
                if (!col._destroy) acc.push(i);
                return acc;
            }, []);
            const visiblePos = visibleIndices.indexOf(index);
            const swapVisiblePos =
                direction === "up" ? visiblePos - 1 : visiblePos + 1;
            if (swapVisiblePos < 0 || swapVisiblePos >= visibleIndices.length)
                return prev;
            const swapIndex = visibleIndices[swapVisiblePos];
            [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
            return next;
        });
    };

    const handleSaveColumns = () => {
        setSavingColumns(true);
        setColumnErrors({});

        const payload = columns.map((col, index) => ({
            id: col.id,
            name: col.name,
            color: col.color,
            wip_limit: col.wip_limit === "" ? null : Number(col.wip_limit),
            is_done_column: col.is_done_column,
            sort_order: index,
            _destroy: col._destroy ?? false,
        }));

        router.put(
            route("teams.boards.columns.reorder", [team.slug, board.slug]),
            { columns: payload },
            {
                onSuccess: () => setSavingColumns(false),
                onError: (errors) => {
                    setColumnErrors(errors as Record<string, string>);
                    setSavingColumns(false);
                },
            },
        );
    };

    const visibleColumns = columns.filter((c) => !c._destroy);

    return (
        <AuthenticatedLayout
            currentTeam={team}
            activeBoardId={board.id}
            header={
                <PageHeader
                    title="Settings"
                    breadcrumbs={[
                        { label: "Teams", href: route("teams.index") },
                        {
                            label: team.name,
                            href: route("teams.show", team.slug),
                        },
                        {
                            label: board.name,
                            href: route("teams.boards.show", [
                                team.slug,
                                board.slug,
                            ]),
                        },
                    ]}
                />
            }
        >
            <Head title={`Settings - ${board.name}`} />

            <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
                {/* Board details */}
                <Card variant="outlined">
                    <CardContent>
                        <Typography
                            variant="subtitle1"
                            fontWeight={600}
                            gutterBottom
                        >
                            Board Details
                        </Typography>
                        <form onSubmit={handleBoardSave}>
                            <TextField
                                label="Board Name"
                                fullWidth
                                required
                                value={boardForm.data.name}
                                onChange={(e) =>
                                    boardForm.setData("name", e.target.value)
                                }
                                error={!!boardForm.errors.name}
                                helperText={boardForm.errors.name}
                                sx={{ mb: 2 }}
                            />
                            <TextField
                                label="Description"
                                fullWidth
                                multiline
                                rows={3}
                                value={boardForm.data.description}
                                onChange={(e) =>
                                    boardForm.setData(
                                        "description",
                                        e.target.value,
                                    )
                                }
                                error={!!boardForm.errors.description}
                                helperText={boardForm.errors.description}
                                sx={{ mb: 2 }}
                            />
                            <FormControlLabel
                                control={
                                    <Checkbox
                                        checked={
                                            boardForm.data.settings
                                                .auto_move_to_done
                                        }
                                        onChange={(e) =>
                                            boardForm.setData("settings", {
                                                ...boardForm.data.settings,
                                                auto_move_to_done:
                                                    e.target.checked,
                                            })
                                        }
                                        size="small"
                                    />
                                }
                                label={
                                    <Typography variant="body2">
                                        Auto-move tasks to Done column when
                                        completed
                                    </Typography>
                                }
                                sx={{ mb: 2 }}
                            />
                            <TextField
                                label="Default Task Template"
                                select
                                fullWidth
                                value={boardForm.data.default_task_template_id}
                                onChange={(e) =>
                                    boardForm.setData(
                                        "default_task_template_id",
                                        e.target.value,
                                    )
                                }
                                helperText="New tasks created on this board will use this template's defaults"
                                sx={{ mb: 2 }}
                            >
                                <MenuItem value="">
                                    <Typography
                                        variant="body2"
                                        color="text.secondary"
                                    >
                                        None
                                    </Typography>
                                </MenuItem>
                                {taskTemplates.map((tmpl) => (
                                    <MenuItem key={tmpl.id} value={tmpl.id}>
                                        {tmpl.name}
                                    </MenuItem>
                                ))}
                            </TextField>
                            <Button
                                type="submit"
                                variant="contained"
                                disabled={boardForm.processing}
                            >
                                Save Details
                            </Button>
                        </form>
                    </CardContent>
                </Card>

                {/* Board Image */}
                <BoardImageUpload board={board} teamId={team.slug} />

                {/* Column management */}
                <Card variant="outlined">
                    <CardContent>
                        <Box
                            sx={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                mb: 2,
                            }}
                        >
                            <Typography variant="subtitle1" fontWeight={600}>
                                Columns
                            </Typography>
                            <Button
                                startIcon={<AddIcon />}
                                size="small"
                                onClick={handleAddColumn}
                            >
                                Add Column
                            </Button>
                        </Box>

                        {columnErrors["columns"] && (
                            <Typography
                                color="error"
                                variant="body2"
                                sx={{ mb: 2 }}
                            >
                                {columnErrors["columns"]}
                            </Typography>
                        )}

                        {visibleColumns.length === 0 ? (
                            <Typography
                                variant="body2"
                                color="text.secondary"
                                sx={{ py: 2 }}
                            >
                                No columns configured. Add a column to get
                                started.
                            </Typography>
                        ) : (
                            <Box
                                sx={{
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: 2,
                                }}
                            >
                                {columns.map((column, index) => {
                                    if (column._destroy) return null;
                                    const visibleIndex =
                                        visibleColumns.indexOf(column);
                                    const isFirst = visibleIndex === 0;
                                    const isLast =
                                        visibleIndex ===
                                        visibleColumns.length - 1;

                                    return (
                                        <Paper
                                            key={column.id ?? `new-${index}`}
                                            variant="outlined"
                                            sx={{ p: 2 }}
                                        >
                                            <Box
                                                sx={{
                                                    display: "flex",
                                                    flexDirection: "column",
                                                    gap: 2,
                                                }}
                                            >
                                                {/* Row 1: Name + color + delete */}
                                                <Box
                                                    sx={{
                                                        display: "flex",
                                                        alignItems: "center",
                                                        gap: 1.5,
                                                    }}
                                                >
                                                    <Box
                                                        sx={{
                                                            display: "flex",
                                                            flexDirection:
                                                                "column",
                                                            gap: 0.25,
                                                        }}
                                                    >
                                                        <IconButton
                                                            size="small"
                                                            disabled={isFirst}
                                                            onClick={() =>
                                                                handleMoveColumn(
                                                                    index,
                                                                    "up",
                                                                )
                                                            }
                                                            aria-label="Move column up"
                                                            sx={{ p: 0.25 }}
                                                        >
                                                            <KeyboardArrowUpIcon fontSize="small" />
                                                        </IconButton>
                                                        <IconButton
                                                            size="small"
                                                            disabled={isLast}
                                                            onClick={() =>
                                                                handleMoveColumn(
                                                                    index,
                                                                    "down",
                                                                )
                                                            }
                                                            aria-label="Move column down"
                                                            sx={{ p: 0.25 }}
                                                        >
                                                            <KeyboardArrowDownIcon fontSize="small" />
                                                        </IconButton>
                                                    </Box>

                                                    <Tooltip title="Click to change color">
                                                        <Box
                                                            component="button"
                                                            type="button"
                                                            onClick={() =>
                                                                setExpandedColumn(
                                                                    expandedColumn ===
                                                                        index
                                                                        ? null
                                                                        : index,
                                                                )
                                                            }
                                                            sx={{
                                                                width: 24,
                                                                height: 24,
                                                                borderRadius:
                                                                    "50%",
                                                                bgcolor:
                                                                    column.color,
                                                                border: "none",
                                                                cursor: "pointer",
                                                                p: 0,
                                                                flexShrink: 0,
                                                                transition:
                                                                    "box-shadow 0.15s",
                                                                "&:hover": {
                                                                    boxShadow:
                                                                        "0 0 0 3px rgba(255,255,255,0.2)",
                                                                },
                                                            }}
                                                        />
                                                    </Tooltip>

                                                    <TextField
                                                        label="Name"
                                                        size="small"
                                                        required
                                                        value={column.name}
                                                        onChange={(e) =>
                                                            handleColumnChange(
                                                                index,
                                                                "name",
                                                                e.target.value,
                                                            )
                                                        }
                                                        error={
                                                            !!columnErrors[
                                                                `columns.${index}.name`
                                                            ]
                                                        }
                                                        helperText={
                                                            columnErrors[
                                                                `columns.${index}.name`
                                                            ]
                                                        }
                                                        sx={{ flex: 1 }}
                                                    />

                                                    <Tooltip title="Remove column">
                                                        <IconButton
                                                            size="small"
                                                            color="error"
                                                            onClick={() =>
                                                                handleRemoveColumn(
                                                                    index,
                                                                )
                                                            }
                                                        >
                                                            <DeleteIcon fontSize="small" />
                                                        </IconButton>
                                                    </Tooltip>
                                                </Box>

                                                {/* Collapsible color picker */}
                                                <Collapse
                                                    in={
                                                        expandedColumn === index
                                                    }
                                                >
                                                    <Box sx={{ pl: 0 }}>
                                                        <Typography
                                                            variant="caption"
                                                            color="text.secondary"
                                                            sx={{
                                                                mb: 1,
                                                                display:
                                                                    "block",
                                                            }}
                                                        >
                                                            Color
                                                        </Typography>
                                                        <ColorSwatchPicker
                                                            value={column.color}
                                                            onChange={(color) =>
                                                                handleColumnChange(
                                                                    index,
                                                                    "color",
                                                                    color,
                                                                )
                                                            }
                                                        />
                                                    </Box>
                                                </Collapse>

                                                {/* Row 2: WIP limit + Done checkbox */}
                                                <Box
                                                    sx={{
                                                        pl: 0,
                                                        display: "flex",
                                                        gap: 3,
                                                        alignItems:
                                                            "flex-start",
                                                    }}
                                                >
                                                    <Box sx={{ flex: 1 }}>
                                                        <TextField
                                                            label="WIP Limit"
                                                            size="small"
                                                            type="number"
                                                            placeholder="No limit"
                                                            fullWidth
                                                            value={
                                                                column.wip_limit
                                                            }
                                                            onChange={(e) =>
                                                                handleColumnChange(
                                                                    index,
                                                                    "wip_limit",
                                                                    e.target
                                                                        .value ===
                                                                        ""
                                                                        ? ""
                                                                        : Number(
                                                                              e
                                                                                  .target
                                                                                  .value,
                                                                          ),
                                                                )
                                                            }
                                                            helperText="Max tasks allowed in this column"
                                                            slotProps={{
                                                                htmlInput: {
                                                                    min: 1,
                                                                },
                                                            }}
                                                        />
                                                    </Box>

                                                    <Box
                                                        sx={{
                                                            flex: 1,
                                                            pt: 0.5,
                                                        }}
                                                    >
                                                        <FormControlLabel
                                                            control={
                                                                <Checkbox
                                                                    checked={
                                                                        column.is_done_column
                                                                    }
                                                                    onChange={(
                                                                        e,
                                                                    ) =>
                                                                        handleColumnChange(
                                                                            index,
                                                                            "is_done_column",
                                                                            e
                                                                                .target
                                                                                .checked,
                                                                        )
                                                                    }
                                                                    size="small"
                                                                />
                                                            }
                                                            label={
                                                                <Typography variant="body2">
                                                                    Mark as
                                                                    "Done"
                                                                    column
                                                                </Typography>
                                                            }
                                                        />
                                                        <Typography
                                                            variant="caption"
                                                            color="text.secondary"
                                                            sx={{
                                                                pl: 3.5,
                                                                display:
                                                                    "block",
                                                            }}
                                                        >
                                                            Tasks moved here are
                                                            considered complete
                                                        </Typography>
                                                    </Box>
                                                </Box>
                                            </Box>
                                        </Paper>
                                    );
                                })}
                            </Box>
                        )}

                        <Divider sx={{ my: 2 }} />

                        <Button
                            variant="contained"
                            onClick={handleSaveColumns}
                            disabled={savingColumns}
                        >
                            Save Columns
                        </Button>
                    </CardContent>
                </Card>

                {/* Task Templates */}
                <Card variant="outlined">
                    <CardContent>
                        <Box
                            sx={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                mb: 2,
                            }}
                        >
                            <Typography variant="subtitle1" fontWeight={600}>
                                Task Templates
                            </Typography>
                            {!showTemplateForm && (
                                <Button
                                    startIcon={<AddIcon />}
                                    size="small"
                                    onClick={() => setShowTemplateForm(true)}
                                >
                                    Add Template
                                </Button>
                            )}
                        </Box>

                        {loadingTemplates ? (
                            <Typography
                                variant="body2"
                                color="text.secondary"
                                sx={{ py: 2 }}
                            >
                                Loading templates...
                            </Typography>
                        ) : taskTemplates.length === 0 && !showTemplateForm ? (
                            <Typography
                                variant="body2"
                                color="text.secondary"
                                sx={{ py: 2 }}
                            >
                                No task templates yet. Create one to quickly add
                                pre-configured tasks.
                            </Typography>
                        ) : (
                            <Box
                                sx={{
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: 1,
                                }}
                            >
                                {taskTemplates.map((tmpl) => (
                                    <Paper
                                        key={tmpl.id}
                                        variant="outlined"
                                        sx={{ px: 2, py: 1.5 }}
                                    >
                                        <Box
                                            sx={{
                                                display: "flex",
                                                alignItems: "center",
                                                gap: 1.5,
                                            }}
                                        >
                                            <Typography
                                                variant="body2"
                                                fontWeight={500}
                                                sx={{ flex: 1 }}
                                            >
                                                {tmpl.name}
                                            </Typography>
                                            {tmpl.priority &&
                                                tmpl.priority !== "none" && (
                                                    <Chip
                                                        label={
                                                            tmpl.priority
                                                                .charAt(0)
                                                                .toUpperCase() +
                                                            tmpl.priority.slice(
                                                                1,
                                                            )
                                                        }
                                                        size="small"
                                                        sx={{
                                                            bgcolor:
                                                                PRIORITY_COLORS[
                                                                    tmpl
                                                                        .priority
                                                                ],
                                                            color: "#fff",
                                                            fontWeight: 500,
                                                            fontSize: "0.7rem",
                                                            height: 22,
                                                        }}
                                                    />
                                                )}
                                            {tmpl.creator && (
                                                <Typography
                                                    variant="caption"
                                                    color="text.secondary"
                                                >
                                                    by {tmpl.creator.name}
                                                </Typography>
                                            )}
                                            <Tooltip title="Delete template">
                                                <IconButton
                                                    size="small"
                                                    color="error"
                                                    onClick={() =>
                                                        handleDeleteTaskTemplate(
                                                            tmpl.id,
                                                        )
                                                    }
                                                >
                                                    <DeleteIcon fontSize="small" />
                                                </IconButton>
                                            </Tooltip>
                                        </Box>
                                    </Paper>
                                ))}
                            </Box>
                        )}

                        {/* Inline create form */}
                        <Collapse in={showTemplateForm}>
                            <Paper variant="outlined" sx={{ p: 2, mt: 2 }}>
                                <Typography
                                    variant="body2"
                                    fontWeight={600}
                                    sx={{ mb: 2 }}
                                >
                                    New Task Template
                                </Typography>
                                <Box
                                    sx={{
                                        display: "flex",
                                        flexDirection: "column",
                                        gap: 2,
                                    }}
                                >
                                    <TextField
                                        label="Name"
                                        size="small"
                                        required
                                        fullWidth
                                        value={templateFormData.name}
                                        onChange={(e) =>
                                            setTemplateFormData((prev) => ({
                                                ...prev,
                                                name: e.target.value,
                                            }))
                                        }
                                        error={!!templateFormErrors.name}
                                        helperText={templateFormErrors.name}
                                    />
                                    <TextField
                                        label="Description"
                                        size="small"
                                        fullWidth
                                        multiline
                                        rows={3}
                                        value={
                                            templateFormData.description_template
                                        }
                                        onChange={(e) =>
                                            setTemplateFormData((prev) => ({
                                                ...prev,
                                                description_template:
                                                    e.target.value,
                                            }))
                                        }
                                        error={
                                            !!templateFormErrors.description_template
                                        }
                                        helperText={
                                            templateFormErrors.description_template
                                        }
                                    />
                                    <Box sx={{ display: "flex", gap: 2 }}>
                                        <TextField
                                            label="Priority"
                                            size="small"
                                            select
                                            value={templateFormData.priority}
                                            onChange={(e) =>
                                                setTemplateFormData((prev) => ({
                                                    ...prev,
                                                    priority: e.target
                                                        .value as TaskTemplate["priority"],
                                                }))
                                            }
                                            sx={{ minWidth: 160 }}
                                        >
                                            {PRIORITY_OPTIONS.map((opt) => (
                                                <MenuItem
                                                    key={opt.value}
                                                    value={opt.value}
                                                >
                                                    <Box
                                                        sx={{
                                                            display: "flex",
                                                            alignItems:
                                                                "center",
                                                            gap: 1,
                                                        }}
                                                    >
                                                        {opt.value !==
                                                            "none" && (
                                                            <Box
                                                                sx={{
                                                                    width: 10,
                                                                    height: 10,
                                                                    borderRadius:
                                                                        "50%",
                                                                    bgcolor:
                                                                        opt.color,
                                                                    flexShrink: 0,
                                                                }}
                                                            />
                                                        )}
                                                        {opt.label}
                                                    </Box>
                                                </MenuItem>
                                            ))}
                                        </TextField>
                                        <TextField
                                            label="Effort Estimate"
                                            size="small"
                                            type="number"
                                            placeholder="Hours"
                                            value={
                                                templateFormData.effort_estimate
                                            }
                                            onChange={(e) =>
                                                setTemplateFormData((prev) => ({
                                                    ...prev,
                                                    effort_estimate:
                                                        e.target.value === ""
                                                            ? ""
                                                            : Number(
                                                                  e.target
                                                                      .value,
                                                              ),
                                                }))
                                            }
                                            error={
                                                !!templateFormErrors.effort_estimate
                                            }
                                            helperText={
                                                templateFormErrors.effort_estimate
                                            }
                                            slotProps={{
                                                htmlInput: {
                                                    min: 0,
                                                    step: 0.5,
                                                },
                                            }}
                                            sx={{ width: 160 }}
                                        />
                                    </Box>
                                    <Box sx={{ display: "flex", gap: 1 }}>
                                        <Button
                                            variant="contained"
                                            size="small"
                                            onClick={handleCreateTaskTemplate}
                                            disabled={savingTaskTemplate}
                                        >
                                            {savingTaskTemplate
                                                ? "Saving..."
                                                : "Save"}
                                        </Button>
                                        <Button
                                            size="small"
                                            onClick={() => {
                                                setShowTemplateForm(false);
                                                setTemplateFormData({
                                                    name: "",
                                                    description_template: "",
                                                    priority: "none",
                                                    effort_estimate: "",
                                                });
                                                setTemplateFormErrors({});
                                            }}
                                        >
                                            Cancel
                                        </Button>
                                    </Box>
                                </Box>
                            </Paper>
                        </Collapse>
                    </CardContent>
                </Card>

                {/* Automation Rules */}
                <AutomationRulesPanel
                    teamId={team.slug}
                    boardId={board.slug}
                    columns={board.columns ?? []}
                    members={members}
                    labels={labels}
                />

                {/* Save as Template */}
                <Card variant="outlined">
                    <CardContent>
                        <Typography
                            variant="subtitle1"
                            fontWeight={600}
                            gutterBottom
                        >
                            Board Template
                        </Typography>
                        <Typography
                            variant="body2"
                            color="text.secondary"
                            sx={{ mb: 2 }}
                        >
                            Save this board's structure (columns, settings, and
                            automation rules) as a reusable template. You can
                            use it later to create new boards with the same
                            setup.
                        </Typography>
                        <Button
                            variant="outlined"
                            startIcon={<SaveIcon />}
                            onClick={handleSaveAsTemplate}
                            disabled={savingTemplate}
                        >
                            {savingTemplate ? "Saving..." : "Save as Template"}
                        </Button>
                    </CardContent>
                </Card>

                {/* Danger Zone */}
                <Card variant="outlined" sx={{ borderColor: "error.main" }}>
                    <CardContent>
                        <Box
                            sx={{
                                display: "flex",
                                alignItems: "center",
                                gap: 1,
                                mb: 1,
                            }}
                        >
                            <WarningAmberIcon color="error" fontSize="small" />
                            <Typography
                                variant="subtitle1"
                                fontWeight={600}
                                color="error"
                            >
                                Danger Zone
                            </Typography>
                        </Box>
                        <Typography
                            variant="body2"
                            color="text.secondary"
                            sx={{ mb: 2 }}
                        >
                            Permanently delete this board and all its columns,
                            tasks, comments, and attachments. This action cannot
                            be undone.
                        </Typography>
                        <Button
                            variant="outlined"
                            color="error"
                            startIcon={<DeleteIcon />}
                            onClick={() => setDeleteBoardOpen(true)}
                        >
                            Delete Board
                        </Button>
                    </CardContent>
                </Card>
            </Box>

            {/* Delete Board Confirmation Dialog */}
            <ConfirmDeleteDialog
                open={deleteBoardOpen}
                onClose={() => setDeleteBoardOpen(false)}
                onConfirm={handleDeleteBoard}
                title="Delete Board"
                description="This will permanently delete this board and all its columns, tasks, comments, and attachments."
                itemName={board.name}
                processing={deletingBoard}
            />

            <Snackbar
                open={templateSnackbar.open}
                autoHideDuration={4000}
                onClose={() =>
                    setTemplateSnackbar((prev) => ({ ...prev, open: false }))
                }
                anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
            >
                <Alert
                    onClose={() =>
                        setTemplateSnackbar((prev) => ({
                            ...prev,
                            open: false,
                        }))
                    }
                    severity={templateSnackbar.severity}
                    variant="filled"
                    sx={{ width: "100%" }}
                >
                    {templateSnackbar.message}
                </Alert>
            </Snackbar>
        </AuthenticatedLayout>
    );
}
