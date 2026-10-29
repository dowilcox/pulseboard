import { harbor } from "@/theme/harbor";
import type { BoardCustomField } from "@/types";
import {
    formatFieldValue,
    hasValue,
    optionTint,
    selectedOptions,
} from "@/utils/customFields";
import CheckBoxOutlinedIcon from "@mui/icons-material/CheckBoxOutlined";
import Box from "@mui/material/Box";
import Link from "@mui/material/Link";

const PILL_SX = {
    display: "inline-flex",
    alignItems: "center",
    gap: "4px",
    fontSize: "11px",
    fontWeight: 700,
    padding: "3px 9px",
    borderRadius: "999px",
    whiteSpace: "nowrap",
    lineHeight: 1.3,
    maxWidth: "100%",
    minWidth: 0,
} as const;

const ELLIPSIS_SX = {
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    minWidth: 0,
} as const;

interface Props {
    field: BoardCustomField;
    value: unknown;
    /**
     * "card": pills that name the field (cards have no column headers);
     * "cell": just the value (list view, where the column names it).
     */
    variant?: "card" | "cell";
}

/**
 * Compact, read-only rendering of one custom field value: option pills
 * for selects, a check for checkboxes, text otherwise. Renders nothing for
 * an empty value.
 */
export default function CustomFieldValue({
    field,
    value,
    variant = "card",
}: Props) {
    if (!hasValue(value)) return null;

    if (field.type === "select" || field.type === "multi_select") {
        return (
            <>
                {selectedOptions(field, value).map((option) => {
                    const tint = optionTint(option.color);
                    return (
                        <Box
                            key={option.id}
                            component="span"
                            title={
                                variant === "card"
                                    ? `${field.name}: ${option.label}`
                                    : undefined
                            }
                            sx={{
                                ...PILL_SX,
                                color: tint.fg,
                                bgcolor: tint.bg,
                            }}
                        >
                            <Box component="span" sx={ELLIPSIS_SX}>
                                {option.label}
                            </Box>
                        </Box>
                    );
                })}
            </>
        );
    }

    if (field.type === "checkbox") {
        return (
            <Box
                component="span"
                sx={{
                    ...PILL_SX,
                    color: harbor.sub,
                    bgcolor: variant === "card" ? harbor.track : "transparent",
                    px: variant === "card" ? "9px" : 0,
                }}
            >
                <CheckBoxOutlinedIcon sx={{ fontSize: 13 }} />
                {variant === "card" && (
                    <Box component="span" sx={ELLIPSIS_SX}>
                        {field.name}
                    </Box>
                )}
            </Box>
        );
    }

    const text = formatFieldValue(field, value);

    if (
        variant === "cell" &&
        field.type === "url" &&
        typeof value === "string"
    ) {
        // Above the list row's stretched link so it stays clickable.
        return (
            <Link
                href={value}
                target="_blank"
                rel="noopener noreferrer"
                underline="hover"
                title={value}
                sx={{
                    ...ELLIPSIS_SX,
                    display: "block",
                    position: "relative",
                    zIndex: 1,
                    fontSize: "0.875rem",
                }}
            >
                {text}
            </Link>
        );
    }

    if (variant === "cell") {
        return (
            <Box
                component="span"
                title={field.type === "url" ? String(value) : text}
                sx={{
                    ...ELLIPSIS_SX,
                    display: "block",
                    fontSize: "0.875rem",
                    color: harbor.sub,
                    fontVariantNumeric:
                        field.type === "number" ? "tabular-nums" : undefined,
                }}
            >
                {text}
            </Box>
        );
    }

    return (
        <Box
            component="span"
            title={`${field.name}: ${text}`}
            sx={{
                ...PILL_SX,
                fontWeight: 600,
                color: harbor.sub,
                bgcolor: harbor.track,
                fontVariantNumeric: "tabular-nums",
            }}
        >
            <Box component="span" sx={{ color: harbor.faint, flexShrink: 0 }}>
                {field.name}
            </Box>
            <Box component="span" sx={{ ...ELLIPSIS_SX, color: harbor.ink }}>
                {text}
            </Box>
        </Box>
    );
}
