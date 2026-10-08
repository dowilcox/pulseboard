import {
    daysUntil,
    parseDateOnly,
    toDateOnlyString,
} from "@/utils/formatTimestamp";

/**
 * Normalize a task's `due_date` prop to the "YYYY-MM-DD" value a native
 * date input expects ("" when unset). Never goes through `new Date(str)`,
 * which would shift the day for anyone west of UTC.
 */
export function toDateInputValue(value?: string | null): string {
    if (!value) return "";
    const date = parseDateOnly(value);
    return Number.isNaN(date.getTime()) ? "" : toDateOnlyString(date);
}

export interface DueDateHint {
    text: string;
    tone: "overdue" | "soon";
}

/** Short status line for an open task's due date, or null when not urgent. */
export function dueDateHint(
    dueDate: string | null | undefined,
    isCompleted: boolean,
    now: Date = new Date(),
): DueDateHint | null {
    if (!dueDate || isCompleted) return null;
    const days = daysUntil(dueDate, now);
    if (Number.isNaN(days)) return null;
    if (days < 0) {
        return {
            text: days === -1 ? "Overdue by 1 day" : `Overdue by ${-days} days`,
            tone: "overdue",
        };
    }
    if (days === 0) return { text: "Due today", tone: "soon" };
    if (days === 1) return { text: "Due tomorrow", tone: "soon" };
    return null;
}

/** Story points are whole numbers; the DB column is an integer. */
const MAX_POINT_DIGITS = 4;

/**
 * Sanitize what the user typed into the effort field: digits only (no
 * decimals, signs or exponents). Returns the text to show and the integer
 * to save (null when empty).
 */
export function parseEffortInput(raw: string): {
    text: string;
    points: number | null;
} {
    const text = raw.replace(/\D/g, "").slice(0, MAX_POINT_DIGITS);
    return { text, points: text === "" ? null : Number.parseInt(text, 10) };
}

/** Task titles are single-line: fold pasted line breaks into spaces. */
export function singleLineTitle(raw: string): string {
    return raw.replace(/\s*[\r\n]+\s*/g, " ");
}
