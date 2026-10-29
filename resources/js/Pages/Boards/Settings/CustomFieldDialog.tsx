import ColorSwatchPicker from "@/Components/Common/ColorSwatchPicker";
import { LABEL_COLORS } from "@/constants/labelColors";
import type { BoardCustomField, CustomFieldType } from "@/types";
import { CUSTOM_FIELD_TYPES, typeHasOptions } from "@/utils/customFields";
import { useForm } from "@inertiajs/react";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import FormControlLabel from "@mui/material/FormControlLabel";
import IconButton from "@mui/material/IconButton";
import MenuItem from "@mui/material/MenuItem";
import Popover from "@mui/material/Popover";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { type FormEvent, useEffect, useId, useRef, useState } from "react";

interface OptionDraft {
    /** Server id for existing options; omitted for new ones. */
    id?: string;
    /** Stable React key. */
    key: string;
    label: string;
    color: string;
}

interface FieldForm {
    name: string;
    type: CustomFieldType;
    show_on_card: boolean;
    options: OptionDraft[];
}

interface Props {
    open: boolean;
    /** The field being edited, or null to add a new one. */
    field: BoardCustomField | null;
    teamSlug: string;
    boardSlug: string;
    onClose: () => void;
}

let draftKey = 0;
const nextKey = () => `draft-${++draftKey}`;

function initialForm(field: BoardCustomField | null): FieldForm {
    return {
        name: field?.name ?? "",
        type: field?.type ?? "text",
        show_on_card: field?.show_on_card ?? false,
        options: (field?.options ?? []).map((o) => ({
            id: o.id,
            key: o.id,
            label: o.label,
            color: o.color,
        })),
    };
}

/** Add or edit a board custom field (name, type, card visibility, options). */
export default function CustomFieldDialog({
    open,
    field,
    teamSlug,
    boardSlug,
    onClose,
}: Props) {
    const titleId = useId();
    const form = useForm<FieldForm>(initialForm(field));
    const [colorAnchor, setColorAnchor] = useState<{
        el: HTMLElement;
        index: number;
    } | null>(null);
    const lastOptionRef = useRef<HTMLInputElement | null>(null);
    const [focusLast, setFocusLast] = useState(false);

    // Start from the field's current values every time the dialog opens.
    useEffect(() => {
        if (!open) return;
        form.setData(initialForm(field));
        form.clearErrors();
        // eslint-disable-next-line react-hooks/exhaustive-deps -- reset on open only
    }, [open, field?.id]);

    useEffect(() => {
        if (focusLast) {
            lastOptionRef.current?.focus();
            setFocusLast(false);
        }
    }, [focusLast]);

    const { data } = form;
    const isEdit = field !== null;
    const withOptions = typeHasOptions(data.type);
    const removedOptions = (field?.options ?? []).filter(
        (o) => !data.options.some((d) => d.id === o.id),
    );

    const setOption = (index: number, patch: Partial<OptionDraft>) =>
        form.setData(
            "options",
            data.options.map((o, i) => (i === index ? { ...o, ...patch } : o)),
        );

    const addOption = () => {
        form.setData("options", [
            ...data.options,
            {
                key: nextKey(),
                label: "",
                color: LABEL_COLORS[data.options.length % LABEL_COLORS.length],
            },
        ]);
        setFocusLast(true);
    };

    const moveOption = (index: number, delta: -1 | 1) => {
        const next = [...data.options];
        const [moved] = next.splice(index, 1);
        next.splice(index + delta, 0, moved);
        form.setData("options", next);
    };

    const removeOption = (index: number) =>
        form.setData(
            "options",
            data.options.filter((_, i) => i !== index),
        );

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        form.transform((d) => ({
            name: d.name,
            ...(isEdit ? {} : { type: d.type }),
            show_on_card: d.show_on_card,
            ...(typeHasOptions(d.type)
                ? {
                      options: d.options.map((o) => ({
                          ...(o.id ? { id: o.id } : {}),
                          label: o.label,
                          color: o.color,
                      })),
                  }
                : {}),
        }));
        const options = { preserveScroll: true, onSuccess: onClose };
        if (field) {
            form.put(
                route("teams.boards.custom-fields.update", [
                    teamSlug,
                    boardSlug,
                    field.id,
                ]),
                options,
            );
        } else {
            form.post(
                route("teams.boards.custom-fields.store", [
                    teamSlug,
                    boardSlug,
                ]),
                options,
            );
        }
    };

    const errors = form.errors as Record<string, string | undefined>;
    const optionListError =
        errors.options ??
        Object.entries(errors).find(
            ([key]) => key.startsWith("options.") && !key.endsWith(".label"),
        )?.[1];

    return (
        <Dialog
            open={open}
            onClose={form.processing ? undefined : onClose}
            maxWidth="sm"
            fullWidth
            aria-labelledby={titleId}
        >
            <Box component="form" onSubmit={handleSubmit} noValidate>
                <DialogTitle id={titleId}>
                    {isEdit ? `Edit “${field.name}”` : "Add custom field"}
                </DialogTitle>
                <DialogContent>
                    <Box
                        sx={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 2,
                            pt: 1,
                        }}
                    >
                        <TextField
                            label="Field name"
                            required
                            autoFocus
                            fullWidth
                            value={data.name}
                            onChange={(e) =>
                                form.setData("name", e.target.value)
                            }
                            error={!!errors.name}
                            helperText={errors.name}
                            slotProps={{ htmlInput: { maxLength: 100 } }}
                        />
                        <TextField
                            label="Type"
                            select
                            fullWidth
                            value={data.type}
                            disabled={isEdit}
                            onChange={(e) => {
                                const type = e.target.value as CustomFieldType;
                                form.setData((d) => ({
                                    ...d,
                                    type,
                                    // A new select starts with one empty option
                                    options:
                                        typeHasOptions(type) &&
                                        d.options.length === 0
                                            ? [
                                                  {
                                                      key: nextKey(),
                                                      label: "",
                                                      color: LABEL_COLORS[0],
                                                  },
                                              ]
                                            : d.options,
                                }));
                            }}
                            error={!!errors.type}
                            helperText={
                                errors.type ??
                                (isEdit
                                    ? "A field’s type can’t be changed after it’s created."
                                    : undefined)
                            }
                        >
                            {CUSTOM_FIELD_TYPES.map((t) => (
                                <MenuItem key={t.value} value={t.value}>
                                    {t.label}
                                </MenuItem>
                            ))}
                        </TextField>
                        <FormControlLabel
                            control={
                                <Checkbox
                                    size="small"
                                    checked={data.show_on_card}
                                    onChange={(e) =>
                                        form.setData(
                                            "show_on_card",
                                            e.target.checked,
                                        )
                                    }
                                />
                            }
                            label={
                                <Typography variant="body2">
                                    Show on task cards
                                </Typography>
                            }
                        />

                        {withOptions && (
                            <Box
                                component="fieldset"
                                sx={{ border: 0, p: 0, m: 0, minWidth: 0 }}
                            >
                                <Typography
                                    component="legend"
                                    variant="subtitle2"
                                    sx={{ mb: 1 }}
                                >
                                    Options
                                </Typography>
                                {optionListError && (
                                    <Alert severity="error" sx={{ mb: 1.5 }}>
                                        {optionListError}
                                    </Alert>
                                )}
                                <Box
                                    sx={{
                                        display: "flex",
                                        flexDirection: "column",
                                        gap: 1,
                                    }}
                                >
                                    {data.options.map((option, index) => {
                                        const label =
                                            option.label ||
                                            `Option ${index + 1}`;
                                        const labelError =
                                            errors[`options.${index}.label`];
                                        return (
                                            <Box
                                                key={option.key}
                                                sx={{
                                                    display: "flex",
                                                    alignItems: "flex-start",
                                                    gap: 1,
                                                }}
                                            >
                                                <Box
                                                    component="button"
                                                    type="button"
                                                    aria-label={`Change color of ${label}`}
                                                    onClick={(e) =>
                                                        setColorAnchor({
                                                            el: e.currentTarget,
                                                            index,
                                                        })
                                                    }
                                                    sx={{
                                                        width: 24,
                                                        height: 24,
                                                        mt: 1,
                                                        borderRadius: "50%",
                                                        bgcolor: option.color,
                                                        border: "none",
                                                        cursor: "pointer",
                                                        p: 0,
                                                        flexShrink: 0,
                                                        "&:focus-visible": {
                                                            outline:
                                                                "2px solid",
                                                            outlineColor:
                                                                "primary.main",
                                                            outlineOffset: 2,
                                                        },
                                                    }}
                                                />
                                                <TextField
                                                    size="small"
                                                    fullWidth
                                                    placeholder="Option label"
                                                    value={option.label}
                                                    inputRef={
                                                        index ===
                                                        data.options.length - 1
                                                            ? lastOptionRef
                                                            : undefined
                                                    }
                                                    onChange={(e) =>
                                                        setOption(index, {
                                                            label: e.target
                                                                .value,
                                                        })
                                                    }
                                                    onKeyDown={(e) => {
                                                        if (
                                                            e.key === "Enter" &&
                                                            index ===
                                                                data.options
                                                                    .length -
                                                                    1
                                                        ) {
                                                            e.preventDefault();
                                                            addOption();
                                                        }
                                                    }}
                                                    error={!!labelError}
                                                    helperText={labelError}
                                                    slotProps={{
                                                        htmlInput: {
                                                            maxLength: 100,
                                                            "aria-label": `Option ${index + 1} label`,
                                                        },
                                                    }}
                                                />
                                                <IconButton
                                                    size="small"
                                                    disabled={index === 0}
                                                    onClick={() =>
                                                        moveOption(index, -1)
                                                    }
                                                    aria-label={`Move ${label} up`}
                                                    sx={{ mt: 0.5 }}
                                                >
                                                    <KeyboardArrowUpIcon fontSize="small" />
                                                </IconButton>
                                                <IconButton
                                                    size="small"
                                                    disabled={
                                                        index ===
                                                        data.options.length - 1
                                                    }
                                                    onClick={() =>
                                                        moveOption(index, 1)
                                                    }
                                                    aria-label={`Move ${label} down`}
                                                    sx={{ mt: 0.5 }}
                                                >
                                                    <KeyboardArrowDownIcon fontSize="small" />
                                                </IconButton>
                                                <IconButton
                                                    size="small"
                                                    color="error"
                                                    disabled={
                                                        data.options.length <= 1
                                                    }
                                                    onClick={() =>
                                                        removeOption(index)
                                                    }
                                                    aria-label={`Remove ${label}`}
                                                    sx={{ mt: 0.5 }}
                                                >
                                                    <DeleteIcon fontSize="small" />
                                                </IconButton>
                                            </Box>
                                        );
                                    })}
                                </Box>
                                <Button
                                    startIcon={<AddIcon />}
                                    size="small"
                                    onClick={addOption}
                                    sx={{ mt: 1 }}
                                >
                                    Add option
                                </Button>
                                {removedOptions.length > 0 && (
                                    <Alert severity="warning" sx={{ mt: 1.5 }}>
                                        Removing{" "}
                                        {removedOptions
                                            .map((o) => `“${o.label}”`)
                                            .join(", ")}{" "}
                                        clears{" "}
                                        {removedOptions.length === 1
                                            ? "it"
                                            : "them"}{" "}
                                        from every task on this board when you
                                        save.
                                    </Alert>
                                )}
                            </Box>
                        )}
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={onClose} disabled={form.processing}>
                        Cancel
                    </Button>
                    <Button
                        type="submit"
                        variant="contained"
                        disabled={form.processing || !data.name.trim()}
                    >
                        {form.processing
                            ? "Saving…"
                            : isEdit
                              ? "Save field"
                              : "Add field"}
                    </Button>
                </DialogActions>
            </Box>

            <Popover
                open={colorAnchor !== null}
                anchorEl={colorAnchor?.el}
                onClose={() => setColorAnchor(null)}
                anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
                slotProps={{ paper: { sx: { p: 1.5, maxWidth: 280 } } }}
            >
                {colorAnchor && data.options[colorAnchor.index] && (
                    <ColorSwatchPicker
                        value={data.options[colorAnchor.index].color}
                        onChange={(color) => {
                            setOption(colorAnchor.index, { color });
                            setColorAnchor(null);
                        }}
                    />
                )}
            </Popover>
        </Dialog>
    );
}
