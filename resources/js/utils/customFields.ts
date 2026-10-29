import type {
    BoardCustomField,
    CustomFieldOption,
    CustomFieldType,
    Task,
} from "@/types";
import { formatDueDate } from "@/utils/formatTimestamp";

/**
 * Board custom fields: value helpers shared by the task sidebar, cards,
 * the list view and filters. Values live in `task.custom_fields[field.id]`
 * and are validated server-side (see App\Support\CustomFieldValues).
 */

export const CUSTOM_FIELD_TYPES: { value: CustomFieldType; label: string }[] = [
    { value: "text", label: "Text" },
    { value: "number", label: "Number" },
    { value: "date", label: "Date" },
    { value: "checkbox", label: "Checkbox" },
    { value: "url", label: "URL" },
    { value: "select", label: "Single select" },
    { value: "multi_select", label: "Multi-select" },
];

export function customFieldTypeLabel(type: CustomFieldType): string {
    return CUSTOM_FIELD_TYPES.find((t) => t.value === type)?.label ?? type;
}

export function typeHasOptions(type: CustomFieldType): boolean {
    return type === "select" || type === "multi_select";
}

/** Filter token: the task has any value for the field (checkbox: checked). */
export const CF_HAS_VALUE = "__set";
/** Filter token: the task has no value for the field (checkbox: unchecked). */
export const CF_NO_VALUE = "__unset";

export function getFieldValue(
    task: Pick<Task, "custom_fields">,
    fieldId: string,
): unknown {
    const values = task.custom_fields as Record<string, unknown> | null;
    return values ? values[fieldId] : undefined;
}

/** True for any stored value; empty strings/lists and `false` count as none. */
export function hasValue(value: unknown): boolean {
    if (value == null || value === false || value === "") return false;
    if (Array.isArray(value)) return value.length > 0;
    return true;
}

/** The field's options picked by `value`, in the field's option order. */
export function selectedOptions(
    field: BoardCustomField,
    value: unknown,
): CustomFieldOption[] {
    const ids = Array.isArray(value)
        ? value
        : typeof value === "string"
          ? [value]
          : [];
    return (field.options ?? []).filter((o) => ids.includes(o.id));
}

/**
 * Tinted pill colors for an option's hex color: dark fg on a pale bg of
 * the same hue (the same treatment task cards give labels).
 */
export function optionTint(hexColor: string): { fg: string; bg: string } {
    const hex = (hexColor ?? "").replace("#", "");
    const full =
        hex.length === 3
            ? hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2]
            : hex;
    const r = parseInt(full.substring(0, 2), 16);
    const g = parseInt(full.substring(2, 4), 16);
    const b = parseInt(full.substring(4, 6), 16);
    if (full.length !== 6 || [r, g, b].some(Number.isNaN)) {
        return { fg: "#222935", bg: "#dde4ea" };
    }
    const mix = (c: number, target: number, amount: number) =>
        Math.round(c + (target - c) * amount);
    return {
        bg: `rgb(${mix(r, 235, 0.82)}, ${mix(g, 238, 0.82)}, ${mix(b, 242, 0.82)})`,
        fg: `rgb(${mix(r, 20, 0.55)}, ${mix(g, 25, 0.55)}, ${mix(b, 35, 0.55)})`,
    };
}

/** "example.com/path" for display; falls back to the raw text. */
export function shortUrl(url: string): string {
    try {
        const parsed = new URL(url);
        const path = parsed.pathname === "/" ? "" : parsed.pathname;
        return `${parsed.host}${path}`;
    } catch {
        return url;
    }
}

/** Plain-text rendering of a value ("" when there is none). */
export function formatFieldValue(
    field: BoardCustomField,
    value: unknown,
): string {
    if (!hasValue(value)) return "";
    switch (field.type) {
        case "number":
            return typeof value === "number"
                ? value.toLocaleString()
                : String(value);
        case "date":
            return typeof value === "string"
                ? formatDueDate(value, { includeYear: true })
                : "";
        case "checkbox":
            return value === true ? "Yes" : "";
        case "url":
            return typeof value === "string" ? shortUrl(value) : "";
        case "select":
        case "multi_select":
            return selectedOptions(field, value)
                .map((o) => o.label)
                .join(", ");
        default:
            return String(value);
    }
}

/** Fields shown on task cards. */
export function cardFields(fields: BoardCustomField[]): BoardCustomField[] {
    return fields.filter((f) => f.show_on_card);
}

/**
 * Accessible summary of a task's card fields, e.g.
 * "Customer: Acme, Severity: Major". Empty fields are skipped.
 */
export function describeCardFields(
    fields: BoardCustomField[],
    task: Pick<Task, "custom_fields">,
): string {
    return cardFields(fields)
        .map((field) => {
            const text = formatFieldValue(field, getFieldValue(task, field.id));
            return text ? `${field.name}: ${text}` : "";
        })
        .filter(Boolean)
        .join(", ");
}

/**
 * Sort key for list view sorting: numbers for number fields and options
 * (by option position), strings otherwise; null when empty (sorts last).
 */
export function sortValue(
    field: BoardCustomField,
    value: unknown,
): number | string | null {
    if (!hasValue(value)) return null;
    switch (field.type) {
        case "number":
            return typeof value === "number" ? value : Number(value);
        case "checkbox":
            return 1;
        case "select":
        case "multi_select": {
            const ids = (field.options ?? []).map((o) => o.id);
            const first = selectedOptions(field, value)[0];
            return first ? ids.indexOf(first.id) : null;
        }
        default:
            return String(value).toLowerCase();
    }
}

export function compareSortValues(
    a: number | string,
    b: number | string,
): number {
    if (typeof a === "number" && typeof b === "number") return a - b;
    return String(a).localeCompare(String(b));
}

/**
 * Does a value match a filter's tokens? Tokens are option ids,
 * CF_HAS_VALUE or CF_NO_VALUE; any one matching is enough (OR).
 */
export function matchesFieldFilter(value: unknown, tokens: string[]): boolean {
    if (tokens.length === 0) return true;
    const present = hasValue(value);
    return tokens.some((token) => {
        if (token === CF_HAS_VALUE) return present;
        if (token === CF_NO_VALUE) return !present;
        return Array.isArray(value) ? value.includes(token) : value === token;
    });
}

/** Fields that can be filtered, and how. */
export function filterKind(
    type: CustomFieldType,
): "options" | "checkbox" | "presence" {
    if (typeHasOptions(type)) return "options";
    if (type === "checkbox") return "checkbox";
    return "presence";
}

/** Human text for one filter selection, e.g. "Severity: Major, Minor". */
export function describeFieldFilter(
    field: BoardCustomField | undefined,
    tokens: string[],
): string {
    if (!field) return "Deleted field";
    const parts = tokens.map((token) => {
        if (field.type === "checkbox") {
            if (token === CF_HAS_VALUE) return "Checked";
            if (token === CF_NO_VALUE) return "Unchecked";
        }
        if (token === CF_HAS_VALUE) return "Has a value";
        if (token === CF_NO_VALUE) return "Empty";
        return (
            field.options?.find((o) => o.id === token)?.label ??
            "Removed option"
        );
    });
    return `${field.name}: ${parts.join(", ")}`;
}

/**
 * Value to send for a field edit, normalized the way the server stores it
 * (so `null` clears): trimmed text, numbers, `true` or nothing for a
 * checkbox, and option id lists.
 */
export function toSaveValue(field: BoardCustomField, input: unknown): unknown {
    switch (field.type) {
        case "checkbox":
            return input === true ? true : null;
        case "multi_select":
            return Array.isArray(input) && input.length > 0 ? input : null;
        case "number": {
            if (typeof input === "number") return input;
            const text = String(input ?? "").trim();
            if (text === "") return null;
            const n = Number(text);
            // Let the server reject junk with a proper message.
            return Number.isFinite(n) ? n : text;
        }
        default: {
            const text = typeof input === "string" ? input.trim() : input;
            return text === "" || text == null ? null : text;
        }
    }
}
