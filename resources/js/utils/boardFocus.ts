/**
 * Pure focus-cursor logic for keyboard navigation on the board views.
 *
 * A layout is the board as the user sees it: columns in display order, each
 * with the ids of its visible tasks in display order. List view is a single
 * pseudo-column of rows. Everything here works on ids so the cursor survives
 * re-renders and real-time reloads (cards are keyed by task id).
 */
import { computeSortOrder } from "@/utils/sortOrder";

export interface FocusColumn {
    id: string;
    taskIds: readonly string[];
}

export type FocusLayout = readonly FocusColumn[];

export interface FocusPosition {
    columnId: string;
    columnIndex: number;
    index: number;
}

export type FocusMove = "up" | "down" | "left" | "right" | "top" | "bottom";

export function locateTask(
    layout: FocusLayout,
    taskId: string | null | undefined,
): FocusPosition | null {
    if (!taskId) return null;
    for (let c = 0; c < layout.length; c++) {
        const index = layout[c].taskIds.indexOf(taskId);
        if (index !== -1) {
            return { columnId: layout[c].id, columnIndex: c, index };
        }
    }
    return null;
}

export function firstTaskId(layout: FocusLayout): string | null {
    for (const column of layout) {
        if (column.taskIds.length > 0) return column.taskIds[0];
    }
    return null;
}

/** Nearest column in `direction` that has tasks, starting after `from`. */
function nearestFilledColumn(
    layout: FocusLayout,
    from: number,
    direction: 1 | -1,
): number {
    for (
        let c = from + direction;
        c >= 0 && c < layout.length;
        c += direction
    ) {
        if (layout[c].taskIds.length > 0) return c;
    }
    return -1;
}

/**
 * Where the cursor goes for a move. With no cursor (or a stale one) any move
 * lands on the first task. Moves stop at the edges rather than wrapping;
 * sideways moves skip empty (or collapsed) columns and keep the row,
 * clamped to the target column's length.
 */
export function nextFocus(
    layout: FocusLayout,
    current: string | null,
    move: FocusMove,
): string | null {
    const position = locateTask(layout, current);
    if (!position) return firstTaskId(layout);

    const ids = layout[position.columnIndex].taskIds;
    switch (move) {
        case "up":
            return ids[Math.max(0, position.index - 1)];
        case "down":
            return ids[Math.min(ids.length - 1, position.index + 1)];
        case "top":
            return ids[0];
        case "bottom":
            return ids[ids.length - 1];
        case "left":
        case "right": {
            const target = nearestFilledColumn(
                layout,
                position.columnIndex,
                move === "left" ? -1 : 1,
            );
            if (target === -1) return current;
            const targetIds = layout[target].taskIds;
            return targetIds[Math.min(position.index, targetIds.length - 1)];
        }
    }
}

/**
 * Keep the cursor meaningful after the layout changes (a reload, a filter,
 * another user deleting or moving the task). A task that is still visible
 * keeps the cursor wherever it moved. Otherwise the cursor takes the task
 * now at its last position in the same column, then the nearest column
 * with tasks (right first, then left), and finally the first task.
 * Returns null only when the board shows no tasks at all.
 */
export function reconcileFocus(
    layout: FocusLayout,
    focusedId: string | null,
    last: Pick<FocusPosition, "columnId" | "index"> | null,
): string | null {
    if (!focusedId) return null;
    if (locateTask(layout, focusedId)) return focusedId;
    if (!last) return firstTaskId(layout);

    const columnIndex = layout.findIndex((c) => c.id === last.columnId);
    if (columnIndex === -1) return firstTaskId(layout);

    const ids = layout[columnIndex].taskIds;
    if (ids.length > 0) return ids[Math.min(last.index, ids.length - 1)];

    const neighbour = [
        nearestFilledColumn(layout, columnIndex, 1),
        nearestFilledColumn(layout, columnIndex, -1),
    ].find((c) => c !== -1);
    if (neighbour === undefined) return null;
    const neighbourIds = layout[neighbour].taskIds;
    return neighbourIds[Math.min(last.index, neighbourIds.length - 1)];
}

/** The roving tab stop: the cursor if visible, else the first task. */
export function tabStopId(
    layout: FocusLayout,
    focusedId: string | null,
): string | null {
    return locateTask(layout, focusedId) ? focusedId : firstTaskId(layout);
}

// ── Keyboard moves ──────────────────────────────────────────────────────

/** A destination: column + index among its visible tasks (mover excluded). */
export interface MoveTarget {
    columnId: string;
    /** Null appends after the column's last task. */
    visibleIndex: number | null;
}

/** ⇧J / ⇧K: one visible slot down/up in the same column, or null at an edge. */
export function planReorder(
    layout: FocusLayout,
    taskId: string,
    direction: 1 | -1,
): MoveTarget | null {
    const position = locateTask(layout, taskId);
    if (!position) return null;
    const ids = layout[position.columnIndex].taskIds;
    const next = position.index + direction;
    if (next < 0 || next >= ids.length) return null;
    return { columnId: position.columnId, visibleIndex: next };
}

/**
 * ⇧H / ⇧L: the adjacent column in board order (collapsed and empty columns
 * included — they are valid drop targets), keeping the card's row.
 */
export function planColumnStep(
    columnOrder: readonly string[],
    layout: FocusLayout,
    taskId: string,
    direction: 1 | -1,
): MoveTarget | null {
    const position = locateTask(layout, taskId);
    if (!position) return null;
    const from = columnOrder.indexOf(position.columnId);
    const to = from + direction;
    if (from === -1 || to < 0 || to >= columnOrder.length) return null;
    const columnId = columnOrder[to];
    const visible = layout.find((c) => c.id === columnId)?.taskIds.length ?? 0;
    return { columnId, visibleIndex: Math.min(position.index, visible) };
}

interface Sortable {
    id: string;
    column_id: string;
    sort_order: number;
}

export interface AppliedMove<T extends Sortable> {
    columns: Record<string, T[]>;
    /** sort_order to send to the move endpoint. */
    sortOrder: number;
    fromColumnId: string;
}

/**
 * Optimistically apply a keyboard move to the loaded column lists and work
 * out the sort_order for the move endpoint (the same midpoint maths as
 * drag and drop). `isVisible` says which tasks the user can see (filters
 * hide some); the visible index is translated to a position in the full
 * list so hidden tasks keep their place. The moved task gets its new
 * column and sort order so a quick second move computes from fresh values.
 */
export function applyMove<T extends Sortable>(
    columns: Record<string, T[]>,
    taskId: string,
    target: MoveTarget,
    isVisible: (task: T) => boolean = () => true,
): AppliedMove<T> | null {
    const fromColumnId = Object.keys(columns).find((id) =>
        columns[id].some((t) => t.id === taskId),
    );
    if (!fromColumnId || !columns[target.columnId]) return null;

    const source = columns[fromColumnId];
    const moving = source.find((t) => t.id === taskId)!;
    const remaining = source.filter((t) => t.id !== taskId);
    const destination =
        fromColumnId === target.columnId
            ? remaining
            : [...columns[target.columnId]];

    const visible = destination.filter(isVisible);
    let insertAt: number;
    if (target.visibleIndex === null) {
        insertAt = destination.length;
    } else if (target.visibleIndex < visible.length) {
        insertAt = destination.indexOf(
            visible[Math.max(0, target.visibleIndex)],
        );
    } else if (visible.length > 0) {
        insertAt = destination.indexOf(visible[visible.length - 1]) + 1;
    } else {
        insertAt = destination.length;
    }

    const sortOrder = computeSortOrder(
        destination.map((t) => t.sort_order),
        insertAt,
    );
    const moved = {
        ...moving,
        column_id: target.columnId,
        sort_order: sortOrder,
    };
    const nextDestination = [...destination];
    nextDestination.splice(insertAt, 0, moved);

    return {
        columns: {
            ...columns,
            [fromColumnId]:
                fromColumnId === target.columnId ? nextDestination : remaining,
            [target.columnId]: nextDestination,
        },
        sortOrder,
        fromColumnId,
    };
}
