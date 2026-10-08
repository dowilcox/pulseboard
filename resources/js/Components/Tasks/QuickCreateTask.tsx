import { harbor } from "@/theme/harbor";
import type { TaskTemplate } from "@/types";
import { router, useForm } from "@inertiajs/react";
import AddIcon from "@mui/icons-material/Add";
import NoteAddIcon from "@mui/icons-material/NoteAdd";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { type FormEvent, type KeyboardEvent, useRef, useState } from "react";

interface Props {
    teamSlug: string;
    boardSlug: string;
    columnId: string;
    columnName: string;
    templates?: TaskTemplate[];
    /** The column is at (or over) its WIP limit. */
    disabled?: boolean;
    wipLimit?: number | null;
    taskCount?: number;
    /**
     * Render just the title form, already open (used when adding from the
     * column header). `onClose` fires when the form is dismissed.
     */
    formOnly?: boolean;
    onClose?: () => void;
}

// Subtle ink wash for hover on the column well
const KANBAN_HOVER = "rgba(34, 41, 53, 0.06)";

export function wipLimitMessage(
    taskCount: number | undefined,
    wipLimit: number | null | undefined,
): string {
    return wipLimit
        ? `This column is at its WIP limit (${taskCount ?? wipLimit} of ${wipLimit}). Move or finish a task before adding another.`
        : "This column is at its WIP limit.";
}

export default function QuickCreateTask({
    teamSlug,
    boardSlug,
    columnId,
    columnName,
    templates = [],
    disabled = false,
    wipLimit,
    taskCount,
    formOnly = false,
    onClose,
}: Props) {
    const [isCreating, setIsCreating] = useState(formOnly);
    const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
    const [selectedTemplate, setSelectedTemplate] =
        useState<TaskTemplate | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const { data, setData, post, processing, reset, errors, clearErrors } =
        useForm({
            title: "",
        });

    // The server reports a WIP-limit race on `column_id`.
    const errorMessage =
        errors.title ?? (errors as Record<string, string | undefined>).column_id;

    const close = () => {
        setIsCreating(false);
        setSelectedTemplate(null);
        reset("title");
        clearErrors();
        onClose?.();
    };

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        if (!data.title.trim()) return;

        if (selectedTemplate) {
            router.post(
                route("tasks.from-template", [
                    teamSlug,
                    boardSlug,
                    columnId,
                    selectedTemplate.id,
                ]),
                { title: data.title },
                {
                    preserveScroll: true,
                    onSuccess: () => {
                        reset("title");
                        setSelectedTemplate(null);
                        inputRef.current?.focus();
                    },
                },
            );
        } else {
            post(route("tasks.store", [teamSlug, boardSlug, columnId]), {
                preserveScroll: true,
                onSuccess: () => {
                    reset("title");
                    inputRef.current?.focus();
                },
            });
        }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
            e.stopPropagation();
            close();
        }
    };

    const handleSelectTemplate = (template: TaskTemplate) => {
        setAnchorEl(null);
        setSelectedTemplate(template);
        setData("title", template.name);
        setIsCreating(true);
        setTimeout(() => {
            inputRef.current?.focus();
            inputRef.current?.select();
        }, 0);
    };

    if (!isCreating) {
        if (formOnly) return null;

        return (
            <Box sx={{ display: "flex", gap: 0.5 }}>
                <Tooltip
                    title={disabled ? wipLimitMessage(taskCount, wipLimit) : ""}
                    // Describe rather than relabel, so the accessible name
                    // stays the visible "WIP limit reached" text.
                    describeChild
                >
                    {/* aria-disabled (not disabled) keeps the button focusable
                        so keyboard users get the explanation too */}
                    <Button
                        startIcon={<AddIcon />}
                        size="small"
                        aria-disabled={disabled || undefined}
                        onClick={() => {
                            if (disabled) return;
                            setSelectedTemplate(null);
                            setIsCreating(true);
                            setTimeout(() => inputRef.current?.focus(), 0);
                        }}
                        sx={{
                            flex: 1,
                            justifyContent: "flex-start",
                            // Quiet add affordance — muted text on wells uses `sub`
                            color: harbor.sub,
                            fontSize: "12.5px",
                            fontWeight: 700,
                            textTransform: "none",
                            px: "6px",
                            "& .MuiButton-startIcon": { mr: 0.5 },
                            "&:hover": {
                                bgcolor: disabled
                                    ? "transparent"
                                    : KANBAN_HOVER,
                            },
                            ...(disabled && { cursor: "not-allowed" }),
                        }}
                    >
                        {disabled ? "WIP limit reached" : "Add task"}
                    </Button>
                </Tooltip>
                {templates.length > 0 && !disabled && (
                    <>
                        <Tooltip title="Create from template">
                            <Button
                                size="small"
                                onClick={(e) => setAnchorEl(e.currentTarget)}
                                sx={{
                                    minWidth: "auto",
                                    color: harbor.sub,
                                    "&:hover": { bgcolor: KANBAN_HOVER },
                                }}
                                aria-label={`Create from template in ${columnName}`}
                                aria-haspopup="menu"
                                aria-expanded={anchorEl ? "true" : undefined}
                            >
                                <NoteAddIcon sx={{ fontSize: 16 }} />
                            </Button>
                        </Tooltip>
                        <Menu
                            anchorEl={anchorEl}
                            open={Boolean(anchorEl)}
                            onClose={() => setAnchorEl(null)}
                        >
                            <MenuItem disabled>
                                <Typography
                                    variant="caption"
                                    color="text.secondary"
                                >
                                    From template
                                </Typography>
                            </MenuItem>
                            {templates.map((tpl) => (
                                <MenuItem
                                    key={tpl.id}
                                    onClick={() => handleSelectTemplate(tpl)}
                                >
                                    {tpl.name}
                                </MenuItem>
                            ))}
                        </Menu>
                    </>
                )}
            </Box>
        );
    }

    return (
        <Box component="form" onSubmit={handleSubmit}>
            <TextField
                inputRef={inputRef}
                size="small"
                fullWidth
                autoFocus
                placeholder={
                    selectedTemplate
                        ? `${selectedTemplate.name}...`
                        : "Task title — Enter to add, Esc to cancel"
                }
                slotProps={{
                    htmlInput: {
                        "aria-label": `New task title in ${columnName}`,
                        maxLength: 255,
                    },
                }}
                value={data.title}
                onChange={(e) => setData("title", e.target.value)}
                onKeyDown={handleKeyDown}
                onBlur={() => {
                    if (!data.title.trim()) close();
                }}
                disabled={processing}
                error={Boolean(errorMessage)}
                sx={{
                    "& .MuiOutlinedInput-root": {
                        bgcolor: harbor.card,
                        borderRadius: "10px",
                        fontSize: "13.5px",
                        ...(selectedTemplate && {
                            borderColor: "primary.main",
                            "& fieldset": { borderColor: "primary.main" },
                        }),
                    },
                }}
                helperText={
                    errorMessage ??
                    (selectedTemplate
                        ? `Template: ${selectedTemplate.name}`
                        : undefined)
                }
            />
        </Box>
    );
}
