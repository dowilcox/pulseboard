/**
 * The task mutations shared by the task page sidebar, the board's drag and
 * drop, and keyboard shortcuts. Each one is a single Inertia visit to the
 * existing endpoint; the server redirects back and the page's props reload.
 */
import type { Task } from "@/types";
import { router } from "@inertiajs/react";

type VisitOptions = NonNullable<Parameters<typeof router.patch>[2]>;
type TaskRef = Pick<Task, "id" | "slug">;

const taskKey = (task: TaskRef) => task.slug ?? task.id;

const withDefaults = (options?: VisitOptions): VisitOptions => ({
    preserveScroll: true,
    ...options,
});

export interface MoveTaskBody {
    column_id: string;
    /** Null lets the server append after the column's last task. */
    sort_order: number | null;
    /** Cross-board moves only. */
    board_id?: string;
}

export function moveTask(
    teamSlug: string,
    boardSlug: string,
    task: TaskRef,
    body: MoveTaskBody,
    options?: VisitOptions,
) {
    router.patch(
        route("tasks.move", [teamSlug, boardSlug, taskKey(task)]),
        { ...body },
        withDefaults(options),
    );
}

export function toggleTaskComplete(
    teamSlug: string,
    boardSlug: string,
    task: TaskRef,
    options?: VisitOptions,
) {
    router.patch(
        route("tasks.toggle-complete", [teamSlug, boardSlug, taskKey(task)]),
        {},
        withDefaults(options),
    );
}

export function toggleTaskWatch(
    teamSlug: string,
    boardSlug: string,
    task: TaskRef,
    options?: VisitOptions,
) {
    router.patch(
        route("tasks.toggle-watch", [teamSlug, boardSlug, taskKey(task)]),
        {},
        withDefaults(options),
    );
}

export function updateTaskAssignees(
    teamSlug: string,
    boardSlug: string,
    task: TaskRef,
    userIds: string[],
    options?: VisitOptions,
) {
    router.put(
        route("tasks.assignees.update", [teamSlug, boardSlug, taskKey(task)]),
        { user_ids: userIds },
        withDefaults(options),
    );
}

export function updateTaskLabels(
    teamSlug: string,
    boardSlug: string,
    task: TaskRef,
    labelIds: string[],
    options?: VisitOptions,
) {
    router.put(
        route("tasks.labels.update", [teamSlug, boardSlug, taskKey(task)]),
        { label_ids: labelIds },
        withDefaults(options),
    );
}

/** Immediate (non-autosaved) field update, e.g. priority or due date. */
export function updateTaskFields(
    teamSlug: string,
    boardSlug: string,
    task: TaskRef,
    fields: { priority?: Task["priority"]; due_date?: string | null },
    options?: VisitOptions,
) {
    router.put(
        route("tasks.update", [teamSlug, boardSlug, taskKey(task)]),
        fields,
        withDefaults(options),
    );
}

/** "Assign to me" toggles the user in or out of the task's assignees. */
export function toggledAssigneeIds(task: Task, userId: string): string[] {
    const ids = (task.assignees ?? []).map((u) => u.id);
    return ids.includes(userId)
        ? ids.filter((id) => id !== userId)
        : [...ids, userId];
}
