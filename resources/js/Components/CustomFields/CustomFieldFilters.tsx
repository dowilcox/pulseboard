import type { BoardCustomField } from "@/types";
import { CF_HAS_VALUE, CF_NO_VALUE, filterKind } from "@/utils/customFields";
import Box from "@mui/material/Box";
import FormControl from "@mui/material/FormControl";
import FormGroup from "@mui/material/FormGroup";
import FormLabel from "@mui/material/FormLabel";
import type { SxProps, Theme } from "@mui/material/styles";
import type { ReactNode } from "react";

type FilterMap = Record<string, string[]>;

interface Props {
    fields: BoardCustomField[];
    value: FilterMap;
    onChange: (next: FilterMap) => void;
    legendSx: SxProps<Theme>;
    /** The filter bar's checkbox row, so these match the other groups. */
    renderCheckbox: (props: {
        key: string;
        checked: boolean;
        onChange: (checked: boolean) => void;
        label: ReactNode;
    }) => ReactNode;
}

/** Choices offered for one field: option ids (+ empty), or set/unset. */
function choicesFor(
    field: BoardCustomField,
): { token: string; label: ReactNode }[] {
    switch (filterKind(field.type)) {
        case "options":
            return [
                ...(field.options ?? []).map((option) => ({
                    token: option.id,
                    label: (
                        <>
                            <Box
                                component="span"
                                sx={{
                                    width: 10,
                                    height: 10,
                                    borderRadius: "50%",
                                    bgcolor: option.color,
                                    flexShrink: 0,
                                }}
                            />
                            {option.label}
                        </>
                    ),
                })),
                { token: CF_NO_VALUE, label: "Empty" },
            ];
        case "checkbox":
            return [
                { token: CF_HAS_VALUE, label: "Checked" },
                { token: CF_NO_VALUE, label: "Unchecked" },
            ];
        default:
            return [
                { token: CF_HAS_VALUE, label: "Has a value" },
                { token: CF_NO_VALUE, label: "Empty" },
            ];
    }
}

/**
 * Filter popover groups for the board's custom fields. Selections within a
 * field match any (OR); different fields must all match (AND).
 */
export default function CustomFieldFilters({
    fields,
    value,
    onChange,
    legendSx,
    renderCheckbox,
}: Props) {
    const toggle = (fieldId: string, token: string, on: boolean) => {
        const current = value[fieldId] ?? [];
        const tokens = on
            ? current.includes(token)
                ? current
                : [...current, token]
            : current.filter((t) => t !== token);
        const next = { ...value };
        if (tokens.length > 0) next[fieldId] = tokens;
        else delete next[fieldId];
        onChange(next);
    };

    return (
        <>
            {fields.map((field) => (
                <FormControl key={field.id} component="fieldset">
                    <FormLabel
                        component="legend"
                        sx={[
                            ...(Array.isArray(legendSx)
                                ? legendSx
                                : [legendSx]),
                            { overflowWrap: "anywhere" },
                        ]}
                    >
                        {field.name}
                    </FormLabel>
                    <FormGroup>
                        {choicesFor(field).map((choice) =>
                            renderCheckbox({
                                key: choice.token,
                                checked: (value[field.id] ?? []).includes(
                                    choice.token,
                                ),
                                onChange: (on) =>
                                    toggle(field.id, choice.token, on),
                                label: choice.label,
                            }),
                        )}
                    </FormGroup>
                </FormControl>
            ))}
        </>
    );
}
