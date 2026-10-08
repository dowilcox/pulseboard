import AutomationRulesPanel from "@/Components/Automation/AutomationRulesPanel";
import BoardImageUpload from "@/Components/Boards/BoardImageUpload";
import ConfirmDeleteDialog from "@/Components/Common/ConfirmDeleteDialog";
import ConfirmDialog from "@/Components/Common/ConfirmDialog";
import LayoutHeader from "@/Components/Layout/LayoutHeader";
import PageHeader from "@/Components/Layout/PageHeader";
import AuthenticatedLayout from "@/Layouts/AuthenticatedLayout";
import BoardColumnsSection from "@/Pages/Boards/Settings/BoardColumnsSection";
import TaskTemplatesSection from "@/Pages/Boards/Settings/TaskTemplatesSection";
import { useBoardColumnsForm } from "@/Pages/Boards/Settings/useBoardColumnsForm";
import { useTaskTemplates } from "@/Pages/Boards/Settings/useTaskTemplates";
import { Head, router, useForm } from "@inertiajs/react";
import RouterLink from "@/Components/Common/RouterLink";
import type { Board, Label, Team, User } from "@/types";
import ArchiveOutlinedIcon from "@mui/icons-material/ArchiveOutlined";
import DeleteIcon from "@mui/icons-material/Delete";
import SaveIcon from "@mui/icons-material/Save";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Checkbox from "@mui/material/Checkbox";
import Divider from "@mui/material/Divider";
import FormControlLabel from "@mui/material/FormControlLabel";
import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { type ReactElement, useEffect, useRef, useState } from "react";

interface Props {
    board: Board;
    team: Team;
    sidebarBoards?: Board[];
    members: User[];
    labels: Label[];
    can: {
        archive: boolean;
        delete: boolean;
        manageTaskTemplates: boolean;
    };
}

export default function BoardSettings({
    board,
    team,
    sidebarBoards = [],
    members,
    labels,
    can,
}: Props) {
    const boardForm = useForm({
        name: board.name,
        description: board.description ?? "",
        default_task_template_id: board.default_task_template_id ?? "",
        settings: {
            auto_move_to_done: board.settings?.auto_move_to_done ?? false,
        },
    });

    const columnsForm = useBoardColumnsForm({
        serverColumns: board.columns ?? [],
        teamSlug: team.slug,
        boardSlug: board.slug,
    });

    const taskTemplates = useTaskTemplates(team.slug);

    // A deleted template can't stay selected as the board default (the
    // database already nulled it via the foreign key).
    const {
        loadingTemplates,
        loadError: templatesLoadError,
        taskTemplates: templateList,
    } = taskTemplates;
    const selectedDefault = boardForm.data.default_task_template_id;
    useEffect(() => {
        if (
            !loadingTemplates &&
            !templatesLoadError &&
            selectedDefault &&
            !templateList.some((t) => t.id === selectedDefault)
        ) {
            boardForm.setData("default_task_template_id", "");
            boardForm.setDefaults("default_task_template_id", "");
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [loadingTemplates, templatesLoadError, templateList, selectedDefault]);

    const [savingTemplate, setSavingTemplate] = useState(false);
    const savingTemplateRef = useRef(false);

    const [archiveOpen, setArchiveOpen] = useState(false);
    const [archiving, setArchiving] = useState(false);
    const [deleteBoardOpen, setDeleteBoardOpen] = useState(false);
    const [deletingBoard, setDeletingBoard] = useState(false);

    const handleBoardSave = (e: React.FormEvent) => {
        e.preventDefault();
        boardForm.put(route("teams.boards.update", [team.slug, board.slug]), {
            preserveScroll: true,
            // Renaming changes the slug and URL; the saved values become the
            // new baseline for "unsaved changes".
            onSuccess: () => boardForm.setDefaults(),
        });
    };

    const handleSaveAsTemplate = () => {
        // Ref guard: a fast double-click fires before the disabled state renders.
        if (savingTemplateRef.current) return;
        savingTemplateRef.current = true;
        setSavingTemplate(true);
        router.post(
            route("boards.create-template", [team.slug, board.slug]),
            {},
            {
                preserveScroll: true,
                onFinish: () => {
                    savingTemplateRef.current = false;
                    setSavingTemplate(false);
                },
            },
        );
    };

    const handleArchive = () => {
        setArchiving(true);
        router.post(
            route("teams.boards.archive", [team.slug, board.slug]),
            {},
            {
                onFinish: () => {
                    setArchiving(false);
                    setArchiveOpen(false);
                },
            },
        );
    };

    const handleDeleteBoard = () => {
        setDeletingBoard(true);
        router.delete(route("teams.boards.destroy", [team.slug, board.slug]), {
            data: { confirmation: "DELETE" },
            onFinish: () => setDeletingBoard(false),
        });
    };

    const boardUrl = route("teams.boards.show", [team.slug, board.slug]);

    return (
        <>
            <Head title={`Board settings - ${board.name}`} />
            <LayoutHeader>
                <PageHeader
                    title="Board settings"
                    breadcrumbs={[
                        {
                            label: team.name,
                            href: route("teams.show", team.slug),
                            teamSwitcher: true,
                        },
                        { label: board.name, href: boardUrl },
                    ]}
                    actions={
                        <Button
                            component={RouterLink}
                            href={boardUrl}
                            variant="outlined"
                            size="small"
                        >
                            Open board
                        </Button>
                    }
                />
            </LayoutHeader>

            <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
                {/* Board details */}
                <Card
                    variant="outlined"
                    component="section"
                    aria-labelledby="board-details-heading"
                >
                    <CardContent>
                        <Typography
                            id="board-details-heading"
                            variant="subtitle1"
                            component="h2"
                            fontWeight={600}
                            gutterBottom
                        >
                            Board details
                        </Typography>
                        <form onSubmit={handleBoardSave} noValidate>
                            <TextField
                                label="Board name"
                                fullWidth
                                required
                                value={boardForm.data.name}
                                onChange={(e) =>
                                    boardForm.setData("name", e.target.value)
                                }
                                error={!!boardForm.errors.name}
                                helperText={
                                    boardForm.errors.name ??
                                    "Renaming also changes the board’s URL."
                                }
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
                                        Auto-move tasks to the Done column when
                                        completed
                                    </Typography>
                                }
                                sx={{ mb: 2 }}
                            />
                            <TextField
                                label="Default task template"
                                select
                                fullWidth
                                value={boardForm.data.default_task_template_id}
                                onChange={(e) =>
                                    boardForm.setData(
                                        "default_task_template_id",
                                        e.target.value,
                                    )
                                }
                                error={
                                    !!boardForm.errors.default_task_template_id
                                }
                                helperText={
                                    boardForm.errors.default_task_template_id ??
                                    "New tasks created on this board start from this template."
                                }
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
                                {templateList.map((tmpl) => (
                                    <MenuItem key={tmpl.id} value={tmpl.id}>
                                        {tmpl.name}
                                    </MenuItem>
                                ))}
                            </TextField>
                            <Button
                                type="submit"
                                variant="contained"
                                disabled={
                                    boardForm.processing || !boardForm.isDirty
                                }
                            >
                                {boardForm.processing
                                    ? "Saving details…"
                                    : "Save details"}
                            </Button>
                        </form>
                    </CardContent>
                </Card>

                <BoardImageUpload board={board} teamSlug={team.slug} />

                <BoardColumnsSection form={columnsForm} />

                <TaskTemplatesSection
                    teamName={team.name}
                    canManageTemplates={can.manageTaskTemplates}
                    templates={taskTemplates}
                />

                <AutomationRulesPanel
                    teamSlug={team.slug}
                    boardSlug={board.slug}
                    columns={board.columns ?? []}
                    members={members}
                    labels={labels}
                />

                {/* Save as board template */}
                <Card
                    variant="outlined"
                    component="section"
                    aria-labelledby="board-template-heading"
                >
                    <CardContent>
                        <Typography
                            id="board-template-heading"
                            variant="subtitle1"
                            component="h2"
                            fontWeight={600}
                            gutterBottom
                        >
                            Board template
                        </Typography>
                        <Typography
                            variant="body2"
                            color="text.secondary"
                            sx={{ mb: 2 }}
                        >
                            Save this board’s columns (names, colors, WIP
                            limits, and Done column) as a reusable template you
                            can pick when creating a new board. Tasks aren’t
                            included.
                        </Typography>
                        <Button
                            variant="outlined"
                            startIcon={<SaveIcon />}
                            onClick={handleSaveAsTemplate}
                            disabled={savingTemplate}
                        >
                            {savingTemplate
                                ? "Saving template…"
                                : "Save as board template"}
                        </Button>
                    </CardContent>
                </Card>

                {/* Danger zone */}
                {(can.archive || can.delete) && (
                    <Card
                        variant="outlined"
                        component="section"
                        aria-labelledby="danger-zone-heading"
                        sx={{ borderColor: "error.main" }}
                    >
                        <CardContent>
                            <Box
                                sx={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 1,
                                    mb: 2,
                                }}
                            >
                                <WarningAmberIcon
                                    color="error"
                                    fontSize="small"
                                />
                                <Typography
                                    id="danger-zone-heading"
                                    variant="subtitle1"
                                    component="h2"
                                    fontWeight={600}
                                    color="error"
                                >
                                    Danger zone
                                </Typography>
                            </Box>

                            {can.archive && (
                                <Box
                                    sx={{
                                        display: "flex",
                                        flexDirection: {
                                            xs: "column",
                                            sm: "row",
                                        },
                                        alignItems: {
                                            xs: "flex-start",
                                            sm: "center",
                                        },
                                        justifyContent: "space-between",
                                        gap: 2,
                                    }}
                                >
                                    <Box>
                                        <Typography
                                            variant="body2"
                                            component="h3"
                                            fontWeight={600}
                                        >
                                            Archive this board
                                        </Typography>
                                        <Typography
                                            variant="body2"
                                            color="text.secondary"
                                        >
                                            Hides the board from the sidebar and
                                            team. Nothing is deleted, and you
                                            can restore it from the team page.
                                        </Typography>
                                    </Box>
                                    <Button
                                        variant="outlined"
                                        color="warning"
                                        startIcon={<ArchiveOutlinedIcon />}
                                        onClick={() => setArchiveOpen(true)}
                                        sx={{ flexShrink: 0 }}
                                    >
                                        Archive board
                                    </Button>
                                </Box>
                            )}

                            {can.archive && can.delete && (
                                <Divider sx={{ my: 2 }} />
                            )}

                            {can.delete && (
                                <Box
                                    sx={{
                                        display: "flex",
                                        flexDirection: {
                                            xs: "column",
                                            sm: "row",
                                        },
                                        alignItems: {
                                            xs: "flex-start",
                                            sm: "center",
                                        },
                                        justifyContent: "space-between",
                                        gap: 2,
                                    }}
                                >
                                    <Box>
                                        <Typography
                                            variant="body2"
                                            component="h3"
                                            fontWeight={600}
                                        >
                                            Delete this board
                                        </Typography>
                                        <Typography
                                            variant="body2"
                                            color="text.secondary"
                                        >
                                            Permanently deletes the board and
                                            all its columns, tasks, comments,
                                            and attachments. This can’t be
                                            undone.
                                        </Typography>
                                    </Box>
                                    <Button
                                        variant="outlined"
                                        color="error"
                                        startIcon={<DeleteIcon />}
                                        onClick={() => setDeleteBoardOpen(true)}
                                        sx={{ flexShrink: 0 }}
                                    >
                                        Delete board
                                    </Button>
                                </Box>
                            )}
                        </CardContent>
                    </Card>
                )}
            </Box>

            <ConfirmDialog
                open={archiveOpen}
                onClose={() => {
                    if (!archiving) setArchiveOpen(false);
                }}
                onConfirm={() => {
                    if (!archiving) handleArchive();
                }}
                title={`Archive “${board.name}”?`}
                message="The board will be hidden from the sidebar and the team’s board list. Its tasks and history are kept, and you can restore it any time from the team page."
                confirmLabel={archiving ? "Archiving…" : "Archive board"}
                confirmColor="warning"
            />

            <ConfirmDeleteDialog
                open={deleteBoardOpen}
                onClose={() => setDeleteBoardOpen(false)}
                onConfirm={handleDeleteBoard}
                title="Delete board"
                description="This will permanently delete this board and all its columns, tasks, comments, and attachments."
                itemName={board.name}
                processing={deletingBoard}
            />
        </>
    );
}

BoardSettings.layout = (props: Props) => [
    AuthenticatedLayout,
    {
        currentTeam: props.team,
        sidebarBoards: props.sidebarBoards ?? [],
        activeBoardId: props.board.id,
    },
];
