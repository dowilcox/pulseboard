import type { Autosave } from "@/hooks/useAutosave";
import { harbor } from "@/theme/harbor";
import type { BoardCustomField, Task } from "@/types";
import { optionTint, selectedOptions, toSaveValue } from "@/utils/customFields";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import Box from "@mui/material/Box";
import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { useEffect, useRef, useState } from "react";

/** The autosave key: values are sent as a partial `custom_fields` map. */
const AUTOSAVE_FIELD = "custom_fields";
/** Debounce for typed values; picks (select, checkbox, date) save at once. */
const TYPING_DELAY = 600;
const PICK_DELAY = 0;

/** Harbor 38px sidebar control, matching TaskSidebar. */
const controlSx = {
    minHeight: 38,
    fontSize: 13,
    fontWeight: 600,
    color: harbor.ink,
    "& .MuiSelect-icon": { color: harbor.faint },
} as const;

type Values = Record<string, unknown>;

interface Props {
    task: Pick<Task, "id" | "custom_fields">;
    fields: BoardCustomField[];
    autosave: Autosave;
    canEdit: boolean;
}

/** Editable value for text-like inputs: numbers shown as typed text. */
function inputText(value: unknown): string {
    if (value == null) return "";
    return String(value);
}

function OptionDot({ color }: { color: string }) {
    return (
        <Box
            component="span"
            aria-hidden
            sx={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                bgcolor: color,
                flexShrink: 0,
            }}
        />
    );
}

/**
 * Sidebar "Fields" card: one editor per board custom field. Edits go
 * through the task page autosave as a partial `custom_fields` payload, so
 * the server merges them and other fields' values are untouched.
 */
export default function TaskCustomFieldsSection({
    task,
    fields,
    autosave,
    canEdit,
}: Props) {
    const serverValues = (task.custom_fields ?? {}) as Values;
    const [values, setValues] = useState<Values>(serverValues);
    // Edits not yet confirmed saved; resent together until the save lands.
    const pendingRef = useRef<Values>({});

    // Take server values unless an edit is still on its way.
    useEffect(() => {
        if (!autosave.isBusy(AUTOSAVE_FIELD)) {
            pendingRef.current = {};
            setValues((task.custom_fields ?? {}) as Values);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps -- sync on prop change only
    }, [task.custom_fields]);

    if (fields.length === 0) return null;

    const change = (field: BoardCustomField, input: unknown, delay: number) => {
        setValues((v) => ({ ...v, [field.id]: input }));
        if (!autosave.isBusy(AUTOSAVE_FIELD)) pendingRef.current = {};
        pendingRef.current = {
            ...pendingRef.current,
            [field.id]: toSaveValue(field, input),
        };
        autosave.schedule(AUTOSAVE_FIELD, pendingRef.current, delay);
    };

    const renderEditor = (field: BoardCustomField, inputId: string) => {
        const value = values[field.id];

        switch (field.type) {
            case "checkbox":
                return (
                    <FormControlLabel
                        control={
                            <Checkbox
                                id={inputId}
                                size="small"
                                checked={value === true}
                                disabled={!canEdit}
                                onChange={(e) =>
                                    change(field, e.target.checked, PICK_DELAY)
                                }
                            />
                        }
                        label={
                            <Typography
                                sx={{ fontSize: 13, color: harbor.ink }}
                            >
                                {value === true ? "Yes" : "No"}
                            </Typography>
                        }
                        sx={{ ml: -0.5, mr: 0 }}
                    />
                );

            case "select": {
                const current =
                    typeof value === "string" &&
                    (field.options ?? []).some((o) => o.id === value)
                        ? value
                        : "";
                return (
                    <Select
                        id={inputId}
                        labelId={`${inputId}-label`}
                        size="small"
                        fullWidth
                        displayEmpty
                        value={current}
                        disabled={!canEdit}
                        onChange={(e) =>
                            change(field, e.target.value || null, PICK_DELAY)
                        }
                        sx={controlSx}
                        renderValue={(selected) => {
                            const option = (field.options ?? []).find(
                                (o) => o.id === selected,
                            );
                            return option ? (
                                <Box
                                    sx={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 1,
                                    }}
                                >
                                    <OptionDot color={option.color} />
                                    {option.label}
                                </Box>
                            ) : (
                                <Box
                                    component="span"
                                    sx={{ color: harbor.faint }}
                                >
                                    None
                                </Box>
                            );
                        }}
                    >
                        <MenuItem value="">
                            <Box component="span" sx={{ color: harbor.sub }}>
                                None
                            </Box>
                        </MenuItem>
                        {(field.options ?? []).map((option) => (
                            <MenuItem key={option.id} value={option.id}>
                                <Box
                                    sx={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 1,
                                    }}
                                >
                                    <OptionDot color={option.color} />
                                    {option.label}
                                </Box>
                            </MenuItem>
                        ))}
                    </Select>
                );
            }

            case "multi_select": {
                const current = selectedOptions(field, value).map((o) => o.id);
                return (
                    <Select<string[]>
                        id={inputId}
                        labelId={`${inputId}-label`}
                        size="small"
                        fullWidth
                        multiple
                        displayEmpty
                        value={current}
                        disabled={!canEdit}
                        onChange={(e) => {
                            const next = e.target.value;
                            const ids =
                                typeof next === "string"
                                    ? next.split(",")
                                    : next;
                            // Keep the field's option order
                            change(
                                field,
                                (field.options ?? [])
                                    .map((o) => o.id)
                                    .filter((id) => ids.includes(id)),
                                PICK_DELAY,
                            );
                        }}
                        sx={controlSx}
                        renderValue={(selected) =>
                            selected.length === 0 ? (
                                <Box
                                    component="span"
                                    sx={{ color: harbor.faint }}
                                >
                                    None
                                </Box>
                            ) : (
                                <Box
                                    sx={{
                                        display: "flex",
                                        flexWrap: "wrap",
                                        gap: 0.5,
                                        py: 0.25,
                                    }}
                                >
                                    {selectedOptions(field, selected).map(
                                        (option) => {
                                            const tint = optionTint(
                                                option.color,
                                            );
                                            return (
                                                <Box
                                                    key={option.id}
                                                    component="span"
                                                    sx={{
                                                        fontSize: 11.5,
                                                        fontWeight: 700,
                                                        color: tint.fg,
                                                        bgcolor: tint.bg,
                                                        px: 1,
                                                        py: "2px",
                                                        borderRadius: "999px",
                                                    }}
                                                >
                                                    {option.label}
                                                </Box>
                                            );
                                        },
                                    )}
                                </Box>
                            )
                        }
                    >
                        {(field.options ?? []).map((option) => (
                            <MenuItem key={option.id} value={option.id}>
                                <Checkbox
                                    size="small"
                                    checked={current.includes(option.id)}
                                    sx={{ p: 0.5, mr: 1 }}
                                />
                                <OptionDot color={option.color} />
                                <Box component="span" sx={{ ml: 1 }}>
                                    {option.label}
                                </Box>
                            </MenuItem>
                        ))}
                    </Select>
                );
            }

            case "date":
                return (
                    <TextField
                        id={inputId}
                        type="date"
                        size="small"
                        fullWidth
                        value={typeof value === "string" ? value : ""}
                        disabled={!canEdit}
                        onChange={(e) =>
                            change(field, e.target.value, PICK_DELAY)
                        }
                        sx={{ "& .MuiOutlinedInput-root": controlSx }}
                    />
                );

            case "url": {
                const url = typeof value === "string" ? value.trim() : "";
                const linkable = /^https?:\/\/\S+$/i.test(url);
                return (
                    <TextField
                        id={inputId}
                        type="url"
                        size="small"
                        fullWidth
                        placeholder="https://"
                        value={inputText(value)}
                        disabled={!canEdit}
                        onChange={(e) =>
                            change(field, e.target.value, TYPING_DELAY)
                        }
                        sx={{ "& .MuiOutlinedInput-root": controlSx }}
                        slotProps={{
                            htmlInput: { autoComplete: "off" },
                            input: {
                                endAdornment: linkable ? (
                                    <InputAdornment position="end">
                                        <Tooltip title="Open link">
                                            <IconButton
                                                size="small"
                                                edge="end"
                                                component="a"
                                                href={url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                aria-label={`Open ${field.name} link in a new tab`}
                                            >
                                                <OpenInNewIcon
                                                    sx={{ fontSize: 15 }}
                                                />
                                            </IconButton>
                                        </Tooltip>
                                    </InputAdornment>
                                ) : undefined,
                            },
                        }}
                    />
                );
            }

            case "number":
                return (
                    <TextField
                        id={inputId}
                        size="small"
                        fullWidth
                        value={inputText(value)}
                        disabled={!canEdit}
                        onChange={(e) =>
                            change(field, e.target.value, TYPING_DELAY)
                        }
                        sx={{ "& .MuiOutlinedInput-root": controlSx }}
                        slotProps={{
                            htmlInput: {
                                inputMode: "decimal",
                                autoComplete: "off",
                            },
                        }}
                    />
                );

            default:
                return (
                    <TextField
                        id={inputId}
                        size="small"
                        fullWidth
                        multiline
                        maxRows={4}
                        value={inputText(value)}
                        disabled={!canEdit}
                        onChange={(e) =>
                            change(field, e.target.value, TYPING_DELAY)
                        }
                        sx={{ "& .MuiOutlinedInput-root": controlSx }}
                        slotProps={{ htmlInput: { maxLength: 1000 } }}
                    />
                );
        }
    };

    return (
        <Box
            component="section"
            aria-label="Custom fields"
            sx={{
                bgcolor: harbor.card,
                borderRadius: "16px",
                boxShadow: harbor.cardShadow,
                p: "14px 16px",
                display: "flex",
                flexDirection: "column",
                gap: 1.5,
            }}
        >
            <Typography
                component="h2"
                sx={{
                    fontSize: 10.5,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.07em",
                    color: harbor.faint,
                }}
            >
                Fields
            </Typography>
            {fields.map((field) => {
                const inputId = `task-${task.id}-cf-${field.id}`;
                const isSelect =
                    field.type === "select" || field.type === "multi_select";
                return (
                    <Box key={field.id}>
                        <Typography
                            component="label"
                            htmlFor={isSelect ? undefined : inputId}
                            id={`${inputId}-label`}
                            sx={{
                                display: "block",
                                fontSize: 12,
                                fontWeight: 700,
                                color: harbor.sub,
                                mb: "4px",
                                overflowWrap: "anywhere",
                            }}
                        >
                            {field.name}
                        </Typography>
                        {renderEditor(field, inputId)}
                    </Box>
                );
            })}
        </Box>
    );
}
