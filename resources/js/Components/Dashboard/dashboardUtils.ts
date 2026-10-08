import {
    daysUntil,
    formatDueDate,
    parseDateOnly,
} from "@/utils/formatTimestamp";
import type { DashboardBoard, DashboardTask } from "./types";

/**
 * Order dashboard boards: starred first (in the order they were starred),
 * then recently visited (most recent first), then everything else in the
 * order the server sent (most recent activity first).
 */
export function orderDashboardBoards<T extends Pick<DashboardBoard, "id">>(
    boards: T[],
    starredIds: string[] = [],
    recentIds: string[] = [],
): T[] {
    const starredRank = new Map(starredIds.map((id, index) => [id, index]));
    const recentRank = new Map(recentIds.map((id, index) => [id, index]));

    const rank = (board: T, index: number): [number, number] => {
        const starred = starredRank.get(board.id);
        if (starred !== undefined) return [0, starred];
        const recent = recentRank.get(board.id);
        if (recent !== undefined) return [1, recent];
        return [2, index];
    };

    return boards
        .map((board, index) => ({ board, key: rank(board, index) }))
        .sort((a, b) => a.key[0] - b.key[0] || a.key[1] - b.key[1])
        .map(({ board }) => board);
}

/** Whole-number completion percentage; 0 for a board with no tasks. */
export function boardProgressPercent(
    board: Pick<DashboardBoard, "done_tasks" | "total_tasks">,
): number {
    if (board.total_tasks <= 0) return 0;
    return Math.round((board.done_tasks / board.total_tasks) * 100);
}

export interface CompletedDelta {
    text: string;
    tone: "up" | "down" | "flat";
}

/**
 * Week-over-week comparison for "completed in the last 7 days". Returns
 * null when there's nothing to compare (both windows empty).
 */
export function completedDelta(
    current: number,
    previous: number,
): CompletedDelta | null {
    if (current === 0 && previous === 0) return null;
    const diff = current - previous;
    if (diff === 0) return { text: "Same as previous 7 days", tone: "flat" };
    return diff > 0
        ? { text: `+${diff} vs previous 7 days`, tone: "up" }
        : { text: `−${Math.abs(diff)} vs previous 7 days`, tone: "down" };
}

const PRIORITY_RANK: Record<DashboardTask["priority"], number> = {
    urgent: 0,
    high: 1,
    medium: 2,
    low: 3,
    none: 4,
};

/** Highest priority first, then soonest due date (undated last). */
export function sortTasksByPriority<
    T extends Pick<DashboardTask, "priority" | "due_date">,
>(tasks: T[]): T[] {
    return tasks
        .map((task, index) => ({ task, index }))
        .sort((a, b) => {
            const byPriority =
                (PRIORITY_RANK[a.task.priority] ?? 4) -
                (PRIORITY_RANK[b.task.priority] ?? 4);
            if (byPriority !== 0) return byPriority;
            const aDue = a.task.due_date;
            const bDue = b.task.due_date;
            if (aDue && bDue && aDue !== bDue) return aDue < bDue ? -1 : 1;
            if (aDue && !bDue) return -1;
            if (!aDue && bDue) return 1;
            return a.index - b.index;
        })
        .map(({ task }) => task);
}

export interface DeadlineGroups<T> {
    overdue: T[];
    dueSoon: T[];
}

/**
 * Split tasks into "overdue" (due day has passed) and "due soon" (today
 * through `withinDays` days from now), each sorted by due date. Uses the
 * viewer's local calendar day; "due today" is never overdue.
 */
export function groupDeadlines<T extends Pick<DashboardTask, "due_date">>(
    tasks: T[],
    withinDays = 14,
    now: Date = new Date(),
): DeadlineGroups<T> {
    const overdue: T[] = [];
    const dueSoon: T[] = [];
    for (const task of tasks) {
        if (!task.due_date) continue;
        const days = daysUntil(task.due_date, now);
        if (days < 0) overdue.push(task);
        else if (days <= withinDays) dueSoon.push(task);
    }
    const byDue = (a: T, b: T) =>
        (a.due_date ?? "") < (b.due_date ?? "")
            ? -1
            : (a.due_date ?? "") > (b.due_date ?? "")
              ? 1
              : 0;
    return { overdue: overdue.sort(byDue), dueSoon: dueSoon.sort(byDue) };
}

export interface DueDescription {
    /** Short label for the due date, e.g. "Today", "Tomorrow", "Mar 4". */
    date: string;
    /** Relative description, e.g. "3 days overdue", "Due in 5 days". */
    relative: string;
    tone: "overdue" | "today" | "soon" | "later";
}

/** Human description of a calendar due date relative to today. */
export function describeDueDate(
    dueDate: string,
    now: Date = new Date(),
): DueDescription {
    const days = daysUntil(dueDate, now);
    const includeYear =
        parseDateOnly(dueDate).getFullYear() !== now.getFullYear();
    const formatted = formatDueDate(dueDate, { includeYear });

    if (days < 0) {
        const late = Math.abs(days);
        return {
            date: formatted,
            relative: late === 1 ? "1 day overdue" : `${late} days overdue`,
            tone: "overdue",
        };
    }
    if (days === 0)
        return { date: "Today", relative: "Due today", tone: "today" };
    if (days === 1) {
        return { date: "Tomorrow", relative: "Due tomorrow", tone: "soon" };
    }
    return {
        date: formatted,
        relative: `Due in ${days} days`,
        tone: days <= 7 ? "soon" : "later",
    };
}

/** Maps a column to a Harbor status pill key. */
export function statusKey(column: {
    name: string;
    is_done_column: boolean;
}): "done" | "inProgress" | "backlog" | "todo" {
    const name = column.name.toLowerCase();
    if (
        column.is_done_column ||
        name.includes("done") ||
        name.includes("complete")
    ) {
        return "done";
    }
    if (
        name.includes("progress") ||
        name.includes("doing") ||
        name.includes("review")
    ) {
        return "inProgress";
    }
    if (name.includes("backlog")) return "backlog";
    return "todo";
}

const FIELD_NAMES: Record<string, string> = {
    title: "title",
    description: "description",
    priority: "priority",
    due_date: "due date",
    effort_estimate: "estimate",
    custom_fields: "custom fields",
    recurrence_config: "recurrence",
    links: "links",
    checklists: "checklist",
    parent_task_id: "parent task",
    gitlab_project_id: "GitLab project",
};

function joinList(items: string[]): string {
    if (items.length <= 1) return items.join("");
    if (items.length === 2) return `${items[0]} and ${items[1]}`;
    return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

function stringList(value: unknown): string[] {
    return Array.isArray(value)
        ? value.filter((item): item is string => typeof item === "string")
        : [];
}

function quoted(value: unknown): string {
    return typeof value === "string" && value !== "" ? `“${value}”` : "";
}

/**
 * Activity sentence around the task title:
 * `${actor} ${before} <task title>${after ? " " + after : ""}`.
 */
export function describeActivity(
    action: string,
    changes: Record<string, unknown> = {},
): { before: string; after: string } {
    switch (action) {
        case "created":
            return { before: "created", after: "" };
        case "completed":
            return { before: "completed", after: "" };
        case "uncompleted":
            return { before: "reopened", after: "" };
        case "commented":
            return { before: "commented on", after: "" };
        case "moved": {
            const verb = changes.auto_moved ? "auto-moved" : "moved";
            if (changes.from_board && changes.to_board) {
                return {
                    before: verb,
                    after: `to the ${String(changes.to_board)} board`,
                };
            }
            if (changes.to_column) {
                return {
                    before: verb,
                    after: changes.from_column
                        ? `from ${String(changes.from_column)} to ${String(changes.to_column)}`
                        : `to ${String(changes.to_column)}`,
                };
            }
            return { before: verb, after: "" };
        }
        case "assigned": {
            const users = stringList(changes.users);
            return {
                before: users.length
                    ? `assigned ${joinList(users)} to`
                    : "updated assignees on",
                after: "",
            };
        }
        case "unassigned": {
            const users = stringList(changes.users);
            return {
                before: users.length
                    ? `unassigned ${joinList(users)} from`
                    : "updated assignees on",
                after: "",
            };
        }
        case "labels_changed": {
            const added = stringList(changes.added);
            const removed = stringList(changes.removed);
            if (added.length && !removed.length) {
                return {
                    before: `added ${added.length === 1 ? "label" : "labels"} ${joinList(added)} to`,
                    after: "",
                };
            }
            if (removed.length && !added.length) {
                return {
                    before: `removed ${removed.length === 1 ? "label" : "labels"} ${joinList(removed)} from`,
                    after: "",
                };
            }
            return { before: "updated labels on", after: "" };
        }
        case "field_changed": {
            const fields = stringList(changes.fields).map(
                (field) => FIELD_NAMES[field] ?? field.replace(/_/g, " "),
            );
            return {
                before: fields.length
                    ? `updated the ${joinList(fields)} of`
                    : "updated",
                after: "",
            };
        }
        case "dependency_added":
            return {
                before: "marked",
                after: changes.depends_on_title
                    ? `as blocked by ${quoted(changes.depends_on_title)}`
                    : "as blocked",
            };
        case "dependency_removed":
            return {
                before: changes.depends_on_title
                    ? `removed blocker ${quoted(changes.depends_on_title)} from`
                    : "removed a blocker from",
                after: "",
            };
        case "attachment_added":
            return {
                before: changes.filename
                    ? `attached ${String(changes.filename)} to`
                    : "added an attachment to",
                after: "",
            };
        case "attachment_removed":
            return {
                before: changes.filename
                    ? `removed ${String(changes.filename)} from`
                    : "removed an attachment from",
                after: "",
            };
        case "gitlab_branch_created":
            return {
                before: changes.branch
                    ? `created branch ${String(changes.branch)} for`
                    : "created a branch for",
                after: "",
            };
        case "gitlab_mr_created":
            return { before: "opened a merge request for", after: "" };
        case "gitlab_mr_merged":
            return { before: "merged a merge request for", after: "" };
        case "gitlab_mr_closed":
            return { before: "closed a merge request for", after: "" };
        default:
            return { before: "updated", after: "" };
    }
}

/** URL of a dashboard task's detail page, or null without board context. */
export function taskHref(task: DashboardTask): string | null {
    const team = task.board?.team;
    if (!team || !task.board) return null;
    return route("tasks.show", [
        team.slug,
        task.board.slug,
        task.slug ?? task.id,
    ]);
}
