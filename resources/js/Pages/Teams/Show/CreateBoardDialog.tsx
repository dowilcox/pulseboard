import ConfirmDialog from "@/Components/Common/ConfirmDialog";
import { useSnackbar } from "@/Contexts/SnackbarContext";
import type { BoardTemplate, PageProps, Team } from "@/types";
import { useForm, usePage } from "@inertiajs/react";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import RadioButtonCheckedIcon from "@mui/icons-material/RadioButtonChecked";
import RadioButtonUncheckedIcon from "@mui/icons-material/RadioButtonUnchecked";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Paper from "@mui/material/Paper";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import axios from "axios";
import { type FormEvent, useEffect, useState } from "react";
import {
    applyTemplateDefaults,
    type BoardDraft,
    EMPTY_DRAFT,
} from "./templateDefaults";

interface Props {
    open: boolean;
    onClose: () => void;
    team: Team;
    /** Server-decided: may this user create boards from templates here? */
    canUseTemplates: boolean;
}

type Mode = "blank" | "template";
type LoadState = "idle" | "loading" | "ready" | "error";

const NAME_MAX = 255;
const DESCRIPTION_MAX = 1000;

function templateColumnCount(template: BoardTemplate): number {
    const columns = (template.template_data as { columns?: unknown })?.columns;
    return Array.isArray(columns) ? columns.length : 0;
}

export default function CreateBoardDialog({
    open,
    onClose,
    team,
    canUseTemplates,
}: Props) {
    const { auth } = usePage<PageProps>().props;
    const { showSnackbar } = useSnackbar();

    const [mode, setMode] = useState<Mode>("blank");
    const [templates, setTemplates] = useState<BoardTemplate[]>([]);
    const [loadState, setLoadState] = useState<LoadState>("idle");
    const [selectedTemplate, setSelectedTemplate] =
        useState<BoardTemplate | null>(null);
    const [autofilled, setAutofilled] = useState<BoardDraft>(EMPTY_DRAFT);
    const [templateToDelete, setTemplateToDelete] =
        useState<BoardTemplate | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    const form = useForm<BoardDraft>({ ...EMPTY_DRAFT });

    useEffect(() => {
        if (!open || !canUseTemplates) return;
        const controller = new AbortController();
        setLoadState("loading");
        axios
            .get<BoardTemplate[]>(route("templates.index"), {
                signal: controller.signal,
            })
            .then(({ data }) => {
                setTemplates(data);
                setLoadState("ready");
            })
            .catch((err) => {
                if (axios.isCancel(err)) return;
                setLoadState("error");
            });
        return () => controller.abort();
    }, [open, canUseTemplates]);

    const resetAll = () => {
        form.reset();
        form.clearErrors();
        setMode("blank");
        setSelectedTemplate(null);
        setAutofilled(EMPTY_DRAFT);
    };

    const selectTemplate = (template: BoardTemplate | null) => {
        setSelectedTemplate(template);
        const result = applyTemplateDefaults(form.data, autofilled, template);
        form.setData(result.draft);
        setAutofilled(result.autofilled);
    };

    const changeMode = (next: Mode) => {
        setMode(next);
        if (next === "blank" && selectedTemplate) {
            selectTemplate(null);
        }
    };

    const canDeleteTemplate = (template: BoardTemplate) =>
        template.created_by === auth.user.id || auth.user.is_admin;

    const confirmDeleteTemplate = async () => {
        const template = templateToDelete;
        if (!template) return;
        setTemplateToDelete(null);
        setDeletingId(template.id);
        try {
            await axios.delete(route("templates.destroy", template.id));
            setTemplates((prev) => prev.filter((t) => t.id !== template.id));
            if (selectedTemplate?.id === template.id) {
                selectTemplate(null);
            }
            showSnackbar(`Template “${template.name}” deleted.`, "success");
        } catch {
            showSnackbar(
                "The template couldn't be deleted. Please try again.",
                "error",
            );
        } finally {
            setDeletingId(null);
        }
    };

    const usingTemplate = mode === "template";

    const submit = (e: FormEvent) => {
        e.preventDefault();
        if (form.processing) return;
        if (usingTemplate) {
            if (!selectedTemplate) return;
            form.post(
                route("teams.templates.create-board", [
                    team.slug,
                    selectedTemplate.id,
                ]),
            );
        } else {
            form.post(route("teams.boards.store", team.slug));
        }
    };

    const submitDisabled =
        form.processing ||
        !form.data.name.trim() ||
        (usingTemplate && !selectedTemplate);

    return (
        <>
            <Dialog
                open={open}
                onClose={form.processing ? undefined : onClose}
                maxWidth="sm"
                fullWidth
                aria-labelledby="create-board-dialog-title"
                slotProps={{ transition: { onExited: resetAll } }}
            >
                <form onSubmit={submit} noValidate>
                    <DialogTitle id="create-board-dialog-title">
                        New board
                    </DialogTitle>
                    <DialogContent>
                        {canUseTemplates && (
                            <Tabs
                                value={mode}
                                onChange={(_, value: Mode) => changeMode(value)}
                                aria-label="How to start the board"
                                sx={{
                                    mb: 2,
                                    borderBottom: 1,
                                    borderColor: "divider",
                                }}
                            >
                                <Tab
                                    value="blank"
                                    label="Blank board"
                                    id="create-board-tab-blank"
                                    aria-controls="create-board-panel"
                                />
                                <Tab
                                    value="template"
                                    label="From template"
                                    id="create-board-tab-template"
                                    aria-controls="create-board-panel"
                                />
                            </Tabs>
                        )}

                        <Box
                            id="create-board-panel"
                            role={canUseTemplates ? "tabpanel" : undefined}
                            aria-labelledby={
                                canUseTemplates
                                    ? `create-board-tab-${mode}`
                                    : undefined
                            }
                            sx={{ pt: canUseTemplates ? 0 : 1 }}
                        >
                            {usingTemplate && (
                                <Box sx={{ mb: 2.5 }}>
                                    <Typography
                                        id="create-board-template-label"
                                        variant="body2"
                                        fontWeight={600}
                                        sx={{ mb: 1 }}
                                    >
                                        Choose a template
                                    </Typography>
                                    {loadState === "loading" && (
                                        <Box
                                            sx={{
                                                display: "flex",
                                                justifyContent: "center",
                                                py: 3,
                                            }}
                                        >
                                            <CircularProgress
                                                size={24}
                                                aria-label="Loading templates"
                                            />
                                        </Box>
                                    )}
                                    {loadState === "error" && (
                                        <Alert severity="error">
                                            Templates couldn't be loaded. Close
                                            this dialog and try again.
                                        </Alert>
                                    )}
                                    {loadState === "ready" &&
                                        templates.length === 0 && (
                                            <Typography
                                                variant="body2"
                                                color="text.secondary"
                                                sx={{ py: 1 }}
                                            >
                                                You haven't saved any board
                                                templates yet. Save an existing
                                                board as a template from its
                                                board settings, then reuse its
                                                columns here.
                                            </Typography>
                                        )}
                                    {loadState === "ready" &&
                                        templates.length > 0 && (
                                            <TemplateList
                                                templates={templates}
                                                selectedId={
                                                    selectedTemplate?.id ?? null
                                                }
                                                deletingId={deletingId}
                                                canDelete={canDeleteTemplate}
                                                onSelect={selectTemplate}
                                                onDelete={setTemplateToDelete}
                                            />
                                        )}
                                </Box>
                            )}

                            <TextField
                                autoFocus={!usingTemplate}
                                label="Board name"
                                fullWidth
                                required
                                value={form.data.name}
                                onChange={(e) =>
                                    form.setData("name", e.target.value)
                                }
                                error={!!form.errors.name}
                                helperText={form.errors.name}
                                sx={{ mb: 2 }}
                                slotProps={{
                                    htmlInput: { maxLength: NAME_MAX },
                                }}
                            />
                            <TextField
                                label="Description"
                                fullWidth
                                multiline
                                minRows={3}
                                value={form.data.description}
                                onChange={(e) =>
                                    form.setData("description", e.target.value)
                                }
                                error={!!form.errors.description}
                                helperText={
                                    form.errors.description ?? "Optional"
                                }
                                slotProps={{
                                    htmlInput: { maxLength: DESCRIPTION_MAX },
                                }}
                            />
                        </Box>
                    </DialogContent>
                    <DialogActions sx={{ px: 3, py: 2 }}>
                        <Button onClick={onClose} disabled={form.processing}>
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            variant="contained"
                            disabled={submitDisabled}
                            startIcon={
                                form.processing ? (
                                    <CircularProgress
                                        size={16}
                                        color="inherit"
                                    />
                                ) : undefined
                            }
                        >
                            {form.processing
                                ? "Creating…"
                                : usingTemplate
                                  ? "Create from template"
                                  : "Create board"}
                        </Button>
                    </DialogActions>
                </form>
            </Dialog>

            <ConfirmDialog
                open={!!templateToDelete}
                onClose={() => setTemplateToDelete(null)}
                onConfirm={confirmDeleteTemplate}
                title={`Delete template “${templateToDelete?.name ?? ""}”?`}
                message="Boards already created from it are not affected. This can't be undone."
                confirmLabel="Delete template"
                confirmColor="error"
            />
        </>
    );
}

function TemplateList({
    templates,
    selectedId,
    deletingId,
    canDelete,
    onSelect,
    onDelete,
}: {
    templates: BoardTemplate[];
    selectedId: string | null;
    deletingId: string | null;
    canDelete: (template: BoardTemplate) => boolean;
    onSelect: (template: BoardTemplate) => void;
    onDelete: (template: BoardTemplate) => void;
}) {
    return (
        <Paper variant="outlined" sx={{ maxHeight: 240, overflow: "auto" }}>
            <List disablePadding aria-labelledby="create-board-template-label">
                {templates.map((template) => {
                    const selected = selectedId === template.id;
                    const columns = templateColumnCount(template);
                    const secondary = [
                        template.description,
                        `${columns} column${columns === 1 ? "" : "s"}`,
                    ]
                        .filter(Boolean)
                        .join(" · ");

                    return (
                        <ListItem
                            key={template.id}
                            disablePadding
                            secondaryAction={
                                canDelete(template) ? (
                                    <Tooltip title="Delete template">
                                        <span>
                                            <IconButton
                                                edge="end"
                                                size="small"
                                                aria-label={`Delete template ${template.name}`}
                                                disabled={
                                                    deletingId === template.id
                                                }
                                                onClick={() =>
                                                    onDelete(template)
                                                }
                                            >
                                                <DeleteOutlineIcon fontSize="small" />
                                            </IconButton>
                                        </span>
                                    </Tooltip>
                                ) : undefined
                            }
                        >
                            <ListItemButton
                                selected={selected}
                                aria-pressed={selected}
                                onClick={() => onSelect(template)}
                            >
                                <ListItemIcon sx={{ minWidth: 36 }}>
                                    {selected ? (
                                        <RadioButtonCheckedIcon
                                            color="primary"
                                            fontSize="small"
                                        />
                                    ) : (
                                        <RadioButtonUncheckedIcon fontSize="small" />
                                    )}
                                </ListItemIcon>
                                <ListItemText
                                    primary={template.name}
                                    secondary={secondary}
                                    slotProps={{
                                        primary: {
                                            variant: "body2",
                                            fontWeight: 600,
                                        },
                                        secondary: {
                                            variant: "caption",
                                            noWrap: true,
                                        },
                                    }}
                                />
                            </ListItemButton>
                        </ListItem>
                    );
                })}
            </List>
        </Paper>
    );
}
