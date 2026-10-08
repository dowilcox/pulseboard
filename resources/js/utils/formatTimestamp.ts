export function formatTimestamp(ts: string): string {
    const date = new Date(ts);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
}

const DATE_ONLY_PREFIX = /^(\d{4})-(\d{2})-(\d{2})/;

/**
 * Parse a calendar date (e.g. a task's `due_date`, serialized as
 * "YYYY-MM-DD") as local midnight.
 *
 * `new Date("2026-03-24")` is parsed as UTC midnight, which renders as
 * Mar 23 for anyone west of UTC. Due dates are calendar days, not instants,
 * so only the date part is used even if a time component is present.
 */
export function parseDateOnly(value: string): Date {
    const match = DATE_ONLY_PREFIX.exec(value);
    if (!match) {
        return new Date(value);
    }
    const [, year, month, day] = match;
    return new Date(Number(year), Number(month) - 1, Number(day));
}

/** Format a Date as a local "YYYY-MM-DD" calendar date string. */
export function toDateOnlyString(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

/**
 * Whole calendar days from today until the given date: 0 = today,
 * 1 = tomorrow, -1 = yesterday.
 */
export function daysUntil(dateOnly: string, now: Date = new Date()): number {
    const target = parseDateOnly(dateOnly);
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

/** A task is overdue once its due day has fully passed (due today is not overdue). */
export function isOverdue(dateOnly: string, now: Date = new Date()): boolean {
    return daysUntil(dateOnly, now) < 0;
}

/** True when the due day is today or within the next `withinDays` days. */
export function isDueSoon(
    dateOnly: string,
    withinDays = 2,
    now: Date = new Date(),
): boolean {
    const days = daysUntil(dateOnly, now);
    return days >= 0 && days <= withinDays;
}

export function formatDueDate(
    date: string,
    options: { includeYear?: boolean } = {},
): string {
    return parseDateOnly(date).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        ...(options.includeYear ? { year: "numeric" as const } : {}),
    });
}
