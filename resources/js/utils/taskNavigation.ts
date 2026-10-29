/**
 * Remembers the task order the board was showing when the user opened a
 * task, so "[" / "]" on the task page step through the same column (Kanban)
 * or list (List view) order, and Esc returns to the board exactly as it was
 * (view + filters live in its URL). Kept per tab in sessionStorage so a
 * reload of the task page still works.
 */

export interface TaskNavEntry {
    id: string;
    slug: string;
}

export interface TaskNavOrder {
    boardId: string;
    /** Board URL (path + query) at the time the task was opened. */
    url: string;
    /** Columns (Kanban) or a single list (List view), in display order. */
    groups: TaskNavEntry[][];
    /** Task to put the board's keyboard cursor on when returning. */
    returnFocusId?: string | null;
}

const STORAGE_KEY = "pulseboard:task-nav-order";

let memory: TaskNavOrder | null = null;

export function saveTaskNavOrder(order: TaskNavOrder): void {
    memory = order;
    try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(order));
    } catch {
        // Storage blocked or full: the in-memory copy still serves this tab.
    }
}

export function loadTaskNavOrder(): TaskNavOrder | null {
    if (memory) return memory;
    try {
        const raw = sessionStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as TaskNavOrder;
        if (
            parsed &&
            typeof parsed.boardId === "string" &&
            typeof parsed.url === "string" &&
            Array.isArray(parsed.groups)
        ) {
            memory = parsed;
            return parsed;
        }
    } catch {
        // Ignore unreadable data.
    }
    return null;
}

/** Record which task the board cursor should land on when going back. */
export function setReturnFocus(boardId: string, taskId: string): void {
    const order = loadTaskNavOrder();
    if (order?.boardId === boardId && order.returnFocusId !== taskId) {
        saveTaskNavOrder({ ...order, returnFocusId: taskId });
    }
}

/** Test seam: forget the in-memory copy. */
export function resetTaskNavMemory(): void {
    memory = null;
}

/**
 * The task before (-1) or after (1) `taskId` in its group, or null at the
 * ends or when the task isn't in the remembered order.
 */
export function adjacentTask(
    groups: readonly (readonly TaskNavEntry[])[],
    taskId: string,
    direction: 1 | -1,
): TaskNavEntry | null {
    for (const group of groups) {
        const index = group.findIndex((entry) => entry.id === taskId);
        if (index === -1) continue;
        return group[index + direction] ?? null;
    }
    return null;
}
