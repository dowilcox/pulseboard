import { describe, expect, it } from "vitest";
import type { Column } from "@/types";
import {
    affectedTaskCount,
    buildColumnsPayload,
    columnsAreDirty,
    moveTargetsFor,
    nearestTargetId,
    removeColumn,
    restoreColumn,
    toColumnFormData,
} from "./columnForm";
import type { ColumnFormData } from "./types";

const col = (
    id: string | undefined,
    name: string,
    tasks = 0,
    extra: Partial<ColumnFormData> = {},
): ColumnFormData => ({
    id,
    name,
    color: "#64748b",
    wip_limit: "",
    is_done_column: false,
    tasks_count: tasks,
    ...extra,
});

describe("toColumnFormData", () => {
    it("maps server columns and defaults missing values", () => {
        const server = [
            {
                id: "a",
                board_id: "b",
                name: "To Do",
                color: "#111111",
                sort_order: 0,
                is_done_column: false,
                tasks_count: 3,
                created_at: "",
                updated_at: "",
            },
        ] as Column[];

        expect(toColumnFormData(server)).toEqual([
            {
                id: "a",
                name: "To Do",
                color: "#111111",
                wip_limit: "",
                is_done_column: false,
                tasks_count: 3,
            },
        ]);
    });
});

describe("buildColumnsPayload", () => {
    it("numbers surviving columns sequentially and sends task disposition for removed ones", () => {
        const payload = buildColumnsPayload([
            col("a", "A", 2, {
                _destroy: true,
                move_tasks_to: "c",
            }),
            col("b", "B", 0, { wip_limit: 3 }),
            col(undefined, "New"),
            col("c", "C"),
        ]);

        expect(payload.map((p) => [p.name, p.sort_order, p._destroy])).toEqual([
            ["A", 0, true],
            ["B", 0, false],
            ["New", 1, false],
            ["C", 2, false],
        ]);
        expect(payload[0]).toMatchObject({
            move_tasks_to: "c",
            delete_tasks: false,
        });
        expect(payload[1].wip_limit).toBe(3);
        expect(payload[1]).not.toHaveProperty("move_tasks_to");
    });

    it("flags an empty removed column as keep-tasks so the server can refuse surprise deletions", () => {
        const [removed] = buildColumnsPayload([
            col("a", "A", 0, { _destroy: true }),
        ]);
        expect(removed).toMatchObject({
            move_tasks_to: null,
            delete_tasks: false,
        });
    });
});

describe("columnsAreDirty", () => {
    const saved = [col("a", "A"), col("b", "B")];

    it("is clean for an identical copy", () => {
        expect(
            columnsAreDirty(
                saved.map((c) => ({ ...c })),
                saved,
            ),
        ).toBe(false);
    });

    it("detects renames, reorders, additions and removals", () => {
        expect(columnsAreDirty([col("a", "A2"), col("b", "B")], saved)).toBe(
            true,
        );
        expect(columnsAreDirty([saved[1], saved[0]], saved)).toBe(true);
        expect(columnsAreDirty([...saved, col(undefined, "")], saved)).toBe(
            true,
        );
        expect(columnsAreDirty(removeColumn(saved, 0, null), saved)).toBe(true);
    });

    it("is clean again after a removal is undone", () => {
        const removed = removeColumn(saved, 0, "b");
        expect(columnsAreDirty(restoreColumn(removed, 0), saved)).toBe(false);
    });
});

describe("removeColumn", () => {
    it("drops unsaved columns outright", () => {
        const columns = [col("a", "A"), col(undefined, "New")];
        expect(removeColumn(columns, 1, null)).toEqual([columns[0]]);
    });

    it("marks saved columns for removal with a move target", () => {
        const next = removeColumn([col("a", "A", 4), col("b", "B")], 0, "b");
        expect(next[0]).toMatchObject({
            _destroy: true,
            move_tasks_to: "b",
            delete_tasks: false,
        });
    });

    it("marks tasks for deletion only when there are tasks", () => {
        expect(
            removeColumn([col("a", "A", 4), col("b", "B")], 0, null)[0],
        ).toMatchObject({ delete_tasks: true, move_tasks_to: null });
        expect(
            removeColumn([col("a", "A", 0), col("b", "B")], 0, null)[0],
        ).toMatchObject({ delete_tasks: false });
    });

    it("re-points columns that were moving tasks into the removed column", () => {
        let columns = [col("a", "A", 2), col("b", "B", 1), col("c", "C")];
        columns = removeColumn(columns, 0, "b");
        expect(affectedTaskCount(columns, 1)).toBe(3);

        columns = removeColumn(columns, 1, "c");
        expect(columns[0].move_tasks_to).toBe("c");
        expect(columns[1].move_tasks_to).toBe("c");

        const deleted = removeColumn(
            removeColumn(
                [col("a", "A", 2), col("b", "B", 1), col("c", "C")],
                0,
                "b",
            ),
            1,
            null,
        );
        expect(deleted[0]).toMatchObject({
            move_tasks_to: null,
            delete_tasks: true,
        });
    });
});

describe("move targets", () => {
    const columns = [
        col("a", "A"),
        col("b", "B", 0, { _destroy: true }),
        col("c", "C"),
        col(undefined, "New"),
        col("d", "D"),
    ];

    it("lists saved, surviving columns other than the one removed", () => {
        expect(moveTargetsFor(columns, 2).map((c) => c.id)).toEqual(["a", "d"]);
    });

    it("prefers the nearest column, earlier on a tie", () => {
        expect(nearestTargetId(columns, 2)).toBe("a");
        expect(nearestTargetId(columns, 4)).toBe("c");
        expect(nearestTargetId([col("a", "A")], 0)).toBeNull();
    });
});
