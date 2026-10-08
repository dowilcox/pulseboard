import type { Task, User } from "@/types";

export const PRIORITY_RANK: Record<Task["priority"], number> = {
    urgent: 0,
    high: 1,
    medium: 2,
    low: 3,
    none: 4,
};

export interface WorkloadGroup {
    /** Member id, or "unassigned". */
    key: string;
    /** null for the Unassigned group. */
    user: User | null;
    tasks: Task[];
    /** Sum of effort estimates (story points); unestimated tasks add 0. */
    points: number;
    /** Tasks without an effort estimate. */
    unestimated: number;
    byPriority: Partial<Record<Task["priority"], number>>;
}

export interface Workload {
    /** Members with active tasks, heaviest first. */
    groups: WorkloadGroup[];
    /** Active tasks nobody is assigned to (null while filtering by assignee). */
    unassigned: WorkloadGroup | null;
    /** Team members with no active tasks (empty while filtering by assignee). */
    idleMembers: User[];
}

function emptyGroup(key: string, user: User | null): WorkloadGroup {
    return {
        key,
        user,
        tasks: [],
        points: 0,
        unestimated: 0,
        byPriority: {},
    };
}

function addTask(group: WorkloadGroup, task: Task): void {
    group.tasks.push(task);
    if (task.effort_estimate == null) {
        group.unestimated += 1;
    } else {
        group.points += task.effort_estimate;
    }
    group.byPriority[task.priority] =
        (group.byPriority[task.priority] ?? 0) + 1;
}

/** Most urgent first, then earliest due date (undated last), then number. */
export function compareWorkloadTasks(a: Task, b: Task): number {
    const priority =
        (PRIORITY_RANK[a.priority] ?? 4) - (PRIORITY_RANK[b.priority] ?? 4);
    if (priority !== 0) return priority;
    const dueA = a.due_date?.slice(0, 10) ?? "9999-12-31";
    const dueB = b.due_date?.slice(0, 10) ?? "9999-12-31";
    if (dueA !== dueB) return dueA < dueB ? -1 : 1;
    return (a.task_number ?? 0) - (b.task_number ?? 0);
}

/**
 * Group a board's active tasks (not completed, not in a done column) by
 * assignee. A task with several assignees counts toward each of them.
 *
 * `onlyAssigneeIds` (an active assignee filter) limits the result to those
 * members — co-assignees of matching tasks would otherwise show partial,
 * misleading totals.
 */
export function computeWorkload({
    tasks,
    members,
    doneColumnIds,
    onlyAssigneeIds = [],
}: {
    tasks: Task[];
    members: User[];
    doneColumnIds: Set<string>;
    onlyAssigneeIds?: string[];
}): Workload {
    const only = new Set(onlyAssigneeIds);
    const restricted = only.size > 0;
    const byUser = new Map<string, WorkloadGroup>();
    const unassigned = emptyGroup("unassigned", null);

    for (const member of members) {
        if (!restricted || only.has(member.id)) {
            byUser.set(member.id, emptyGroup(member.id, member));
        }
    }

    for (const task of tasks) {
        if (task.completed_at || doneColumnIds.has(task.column_id)) continue;

        const assignees = task.assignees ?? [];
        if (assignees.length === 0) {
            if (!restricted) addTask(unassigned, task);
            continue;
        }

        for (const assignee of assignees) {
            if (restricted && !only.has(assignee.id)) continue;
            let group = byUser.get(assignee.id);
            if (!group) {
                // Assigned but no longer an active member — still show it.
                group = emptyGroup(assignee.id, assignee);
                byUser.set(assignee.id, group);
            }
            addTask(group, task);
        }
    }

    const all = [...byUser.values()];
    for (const group of all) group.tasks.sort(compareWorkloadTasks);
    unassigned.tasks.sort(compareWorkloadTasks);

    const groups = all
        .filter((g) => g.tasks.length > 0)
        .sort(
            (a, b) =>
                b.points - a.points ||
                b.tasks.length - a.tasks.length ||
                (a.user?.name ?? "").localeCompare(b.user?.name ?? ""),
        );

    const idleMembers = restricted
        ? []
        : all
              .filter((g) => g.tasks.length === 0 && g.user)
              .map((g) => g.user as User)
              .sort((a, b) => a.name.localeCompare(b.name));

    return {
        groups,
        unassigned: restricted ? null : unassigned,
        idleMembers,
    };
}
