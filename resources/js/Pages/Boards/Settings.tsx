import AutomationRulesPanel from "@/Components/Automation/AutomationRulesPanel";
import BoardImageUpload from "@/Components/Boards/BoardImageUpload";
import ConfirmDeleteDialog from "@/Components/Common/ConfirmDeleteDialog";
import PageHeader from "@/Components/Layout/PageHeader";
import AuthenticatedLayout from "@/Layouts/AuthenticatedLayout";
import BoardColumnsSection from "@/Pages/Boards/Settings/BoardColumnsSection";
import TaskTemplatesSection from "@/Pages/Boards/Settings/TaskTemplatesSection";
import type { ColumnFormData } from "@/Pages/Boards/Settings/types";
import { useBoardColumnsForm } from "@/Pages/Boards/Settings/useBoardColumnsForm";
import { useTaskTemplates } from "@/Pages/Boards/Settings/useTaskTemplates";
import { Head, useForm, router } from "@inertiajs/react";
import type { Board, Column, Label, TaskTemplate, Team, User } from "@/types";
import DeleteIcon from "@mui/icons-material/Delete";
import SaveIcon from "@mui/icons-material/Save";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
import MenuItem from "@mui/material/MenuItem";
import Snackbar from "@mui/material/Snackbar";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useState } from "react";

interface Props {
    board: Board;
    team: Team;
    sidebarBoards?: Board[];
    members: User[];
    labels: Label[];
}

export default function BoardSettings({
    board,
    team,
    sidebarBoards = [],
    members,
    labels,
}: Props) {
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

    const {
        columns,
        columnErrors,
        expandedColumn,
        savingColumns,
        visibleColumns,
        handleAddColumn,
        handleColumnChange,
        handleMoveColumn,
        handleRemoveColumn,
        handleSaveColumns,
        toggleExpandedColumn,
    } = useBoardColumnsForm({
        initialColumns,
        teamSlug: team.slug,
        boardSlug: board.slug,
    });
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

    const {
        loadingTemplates,
        savingTaskTemplate,
        showTemplateForm,
        taskTemplates,
        templateFormData,
        templateFormErrors,
        handleCreateTaskTemplate,
        handleDeleteTaskTemplate,
        handleTemplateFieldChange,
        openTemplateForm,
        resetTemplateForm,
    } = useTaskTemplates(team.slug);

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

    return (
        <AuthenticatedLayout
            currentTeam={team}
            sidebarBoards={sidebarBoards}
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

                <BoardColumnsSection
                    columns={columns}
                    visibleColumns={visibleColumns}
                    columnErrors={columnErrors}
                    expandedColumn={expandedColumn}
                    savingColumns={savingColumns}
                    onAddColumn={handleAddColumn}
                    onColumnChange={handleColumnChange}
                    onMoveColumn={handleMoveColumn}
                    onRemoveColumn={handleRemoveColumn}
                    onSaveColumns={handleSaveColumns}
                    onToggleExpandedColumn={toggleExpandedColumn}
                />

                <TaskTemplatesSection
                    loadingTemplates={loadingTemplates}
                    savingTaskTemplate={savingTaskTemplate}
                    showTemplateForm={showTemplateForm}
                    taskTemplates={taskTemplates}
                    templateFormData={templateFormData}
                    templateFormErrors={templateFormErrors}
                    onCreateTaskTemplate={handleCreateTaskTemplate}
                    onDeleteTaskTemplate={handleDeleteTaskTemplate}
                    onTemplateFieldChange={handleTemplateFieldChange}
                    onOpenTemplateForm={openTemplateForm}
                    onResetTemplateForm={resetTemplateForm}
                />

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
