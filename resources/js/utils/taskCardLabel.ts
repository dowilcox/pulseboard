import type { Task } from "@/types";
import { daysUntil, formatDueDate } from "@/utils/formatTimestamp";
import { getTaskLabel } from "@/utils/gitlabPrefix";

const PRIORITY_LABEL: Record<Task["priority"], string> = {
    urgent: "Urgent",
    high: "High",
    medium: "Medium",
    low: "Low",
    none: "No",
};

export function priorityLabel(priority: Task["priority"]): string {
    return PRIORITY_LABEL[priority] ?? priority;
}

/** "due today", "due tomorrow", "overdue, due Mar 20", "due Mar 24". */
export function describeDueDate(
    dueDate: string,
    completed: boolean,
    now: Date = new Date(),
): string {
    const formatted = formatDueDate(dueDate);
    if (completed) return `due ${formatted}`;
    const days = daysUntil(dueDate, now);
    if (Number.isNaN(days)) return `due ${formatted}`;
    if (days < 0) return `overdue, due ${formatted}`;
    if (days === 0) return "due today";
    if (days === 1) return "due tomorrow";
    return `due ${formatted}`;
}

function plural(count: number, singular: string, pluralForm = `${singular}s`) {
    return `${count} ${count === 1 ? singular : pluralForm}`;
}

/**
 * Accessible name for a task card link: everything the card shows, once,
 * in reading order, e.g.
 * "#8 Add search functionality, High priority, due Mar 24, 5 comments,
 *  assigned to Alice Admin, Eve Evans".
 */
export function describeTaskCard(task: Task, now: Date = new Date()): string {
    const completed = task.completed_at != null;
    const parts: string[] = [getTaskLabel(task)];

    if (completed) parts.push("completed");
    if ((task.blocked_by ?? []).length > 0) parts.push("blocked");
    if (task.priority && task.priority !== "none") {
        parts.push(`${priorityLabel(task.priority)} priority`);
    }
    if (task.due_date) {
        parts.push(describeDueDate(task.due_date, completed, now));
    }

    const labels = task.labels ?? [];
    if (labels.length > 0) {
        parts.push(
            `${labels.length === 1 ? "label" : "labels"} ${labels.map((l) => l.name).join(", ")}`,
        );
    }

    const mergeRequests = (task.gitlab_refs ?? []).filter(
        (r) => r.ref_type === "merge_request",
    );
    for (const mr of mergeRequests) {
        parts.push(
            `merge request !${mr.gitlab_iid}${mr.state ? ` ${mr.state}` : ""}`,
        );
    }

    const progress = task.checklist_progress;
    if (progress && progress.total > 0) {
        parts.push(`checklist ${progress.completed} of ${progress.total}`);
    }

    const subtasks = task.subtasks_count ?? 0;
    if (subtasks > 0) {
        parts.push(
            `${task.completed_subtasks_count ?? 0} of ${plural(subtasks, "subtask")} done`,
        );
    }

    const comments = task.comments_count ?? 0;
    if (comments > 0) parts.push(plural(comments, "comment"));

    if (task.effort_estimate != null && task.effort_estimate > 0) {
        parts.push(plural(task.effort_estimate, "point"));
    }

    const assignees = task.assignees ?? [];
    if (assignees.length > 0) {
        parts.push(`assigned to ${assignees.map((a) => a.name).join(", ")}`);
    }

    return parts.join(", ");
}
