import type { Column } from "@/types";
import type { ColumnFormData } from "./types";

// A type alias (not an interface) so it satisfies Inertia's payload index
// signature.
export type ColumnPayload = {
    id?: string;
    name: string;
    color: string;
    wip_limit: number | null;
    is_done_column: boolean;
    sort_order: number;
    _destroy: boolean;
    move_tasks_to?: string | null;
    delete_tasks?: boolean;
};

/** Map server columns to editable form rows. */
export function toColumnFormData(columns: Column[]): ColumnFormData[] {
    return columns.map((column) => ({
        id: column.id,
        name: column.name,
        color: column.color,
        wip_limit: column.wip_limit ?? "",
        is_done_column: column.is_done_column,
        tasks_count: column.tasks_count ?? 0,
    }));
}

/**
 * Build the PUT payload. Surviving columns get sequential sort orders; a
 * removed column says what happens to its tasks. `delete_tasks: false`
 * tells the server the column is expected to be empty, so it refuses to
 * delete tasks added since the page loaded.
 */
export function buildColumnsPayload(
    columns: ColumnFormData[],
): ColumnPayload[] {
    let position = 0;

    return columns.map((column) => {
        const base = {
            id: column.id,
            name: column.name,
            color: column.color,
            wip_limit:
                column.wip_limit === "" ? null : Number(column.wip_limit),
            is_done_column: column.is_done_column,
        };

        if (column._destroy) {
            return {
                ...base,
                sort_order: 0,
                _destroy: true,
                move_tasks_to: column.move_tasks_to ?? null,
                delete_tasks: column.delete_tasks ?? false,
            };
        }

        return { ...base, sort_order: position++, _destroy: false };
    });
}

/** True when the form differs from the columns last saved on the server. */
export function columnsAreDirty(
    current: ColumnFormData[],
    saved: ColumnFormData[],
): boolean {
    return (
        JSON.stringify(buildColumnsPayload(current)) !==
        JSON.stringify(buildColumnsPayload(saved))
    );
}

/** Existing, non-removed columns other than `index` that can receive tasks. */
export function moveTargetsFor(
    columns: ColumnFormData[],
    index: number,
): ColumnFormData[] {
    return columns.filter(
        (column, i) => i !== index && !!column.id && !column._destroy,
    );
}

/** The move target closest to `index`, preferring the column before it. */
export function nearestTargetId(
    columns: ColumnFormData[],
    index: number,
): string | null {
    let bestId: string | null = null;
    let bestDistance = Infinity;

    for (let i = 0; i < columns.length; i++) {
        const column = columns[i];
        if (i === index || !column.id || column._destroy) continue;

        // Strict "<" lets the earlier column win a tie.
        const distance = Math.abs(i - index);
        if (distance < bestDistance) {
            bestId = column.id;
            bestDistance = distance;
        }
    }

    return bestId;
}

/**
 * Tasks that removing column `index` affects: its own, plus tasks from
 * already-removed columns that were set to move into it.
 */
export function affectedTaskCount(
    columns: ColumnFormData[],
    index: number,
): number {
    const column = columns[index];
    if (!column) return 0;

    const incoming = column.id
        ? columns
              .filter((c) => c._destroy && c.move_tasks_to === column.id)
              .reduce((sum, c) => sum + (c.tasks_count ?? 0), 0)
        : 0;

    return (column.tasks_count ?? 0) + incoming;
}

/**
 * Remove column `index`. New (unsaved) columns are dropped; existing ones
 * are marked for removal with their tasks either moved to `moveTo` or
 * deleted (`moveTo === null`). Columns already set to move their tasks into
 * this one follow the same choice.
 */
export function removeColumn(
    columns: ColumnFormData[],
    index: number,
    moveTo: string | null,
): ColumnFormData[] {
    const column = columns[index];
    if (!column) return columns;

    if (!column.id) {
        return columns.filter((_, i) => i !== index);
    }

    const disposition = {
        move_tasks_to: moveTo,
        delete_tasks: moveTo === null && affectedTaskCount(columns, index) > 0,
    };

    return columns.map((c, i) => {
        if (i === index) {
            return { ...c, _destroy: true, ...disposition };
        }
        if (c._destroy && c.move_tasks_to === column.id) {
            return {
                ...c,
                move_tasks_to: moveTo,
                delete_tasks: moveTo === null && (c.tasks_count ?? 0) > 0,
            };
        }
        return c;
    });
}

/**
 * Undo a pending removal. Columns that were re-pointed when this one was
 * removed keep their new target.
 */
export function restoreColumn(
    columns: ColumnFormData[],
    index: number,
): ColumnFormData[] {
    return columns.map((c, i) =>
        i === index
            ? {
                  ...c,
                  _destroy: false,
                  move_tasks_to: undefined,
                  delete_tasks: undefined,
              }
            : c,
    );
}
