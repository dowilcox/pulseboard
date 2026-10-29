import { describe, expect, it } from "vitest";
import {
    applyMove,
    firstTaskId,
    type FocusLayout,
    locateTask,
    nextFocus,
    planColumnStep,
    planReorder,
    reconcileFocus,
    tabStopId,
} from "./boardFocus";

const layout: FocusLayout = [
    { id: "todo", taskIds: ["a", "b", "c"] },
    { id: "empty", taskIds: [] },
    { id: "doing", taskIds: ["d"] },
    { id: "done", taskIds: ["e", "f"] },
];

describe("locateTask / firstTaskId", () => {
    it("finds positions and the first task", () => {
        expect(locateTask(layout, "f")).toEqual({
            columnId: "done",
            columnIndex: 3,
            index: 1,
        });
        expect(locateTask(layout, "zzz")).toBeNull();
        expect(locateTask(layout, null)).toBeNull();
        expect(firstTaskId(layout)).toBe("a");
        expect(firstTaskId([{ id: "x", taskIds: [] }])).toBeNull();
    });
});

describe("nextFocus", () => {
    it("starts on the first task without a (valid) cursor", () => {
        expect(nextFocus(layout, null, "down")).toBe("a");
        expect(nextFocus(layout, "gone", "right")).toBe("a");
        expect(nextFocus([], null, "down")).toBeNull();
    });

    it("moves within a column and stops at the ends", () => {
        expect(nextFocus(layout, "a", "down")).toBe("b");
        expect(nextFocus(layout, "c", "down")).toBe("c");
        expect(nextFocus(layout, "b", "up")).toBe("a");
        expect(nextFocus(layout, "a", "up")).toBe("a");
        expect(nextFocus(layout, "b", "bottom")).toBe("c");
        expect(nextFocus(layout, "c", "top")).toBe("a");
    });

    it("moves between columns, skipping empty ones and clamping the row", () => {
        expect(nextFocus(layout, "c", "right")).toBe("d");
        expect(nextFocus(layout, "d", "right")).toBe("e");
        expect(nextFocus(layout, "d", "left")).toBe("a");
        expect(nextFocus(layout, "f", "left")).toBe("d");
        expect(nextFocus(layout, "b", "right")).toBe("d");
    });

    it("keeps the row when the target column is long enough", () => {
        const wide: FocusLayout = [
            { id: "x", taskIds: ["x1", "x2", "x3"] },
            { id: "y", taskIds: ["y1", "y2", "y3"] },
        ];
        expect(nextFocus(wide, "x2", "right")).toBe("y2");
    });

    it("stays put at the outer edges", () => {
        expect(nextFocus(layout, "a", "left")).toBe("a");
        expect(nextFocus(layout, "e", "right")).toBe("e");
    });
});

describe("reconcileFocus", () => {
    it("keeps a task that is still visible, wherever it moved", () => {
        expect(
            reconcileFocus(layout, "e", { columnId: "todo", index: 0 }),
        ).toBe("e");
    });

    it("takes the task now at the old position in the same column", () => {
        // "b" was deleted: "c" slid up into index 1.
        const next: FocusLayout = [
            { id: "todo", taskIds: ["a", "c"] },
            ...layout.slice(1),
        ];
        expect(reconcileFocus(next, "b", { columnId: "todo", index: 1 })).toBe(
            "c",
        );
        // The last card went away: clamp to the new last one.
        expect(reconcileFocus(next, "z", { columnId: "todo", index: 5 })).toBe(
            "c",
        );
    });

    it("falls back to the nearest column with tasks (right first)", () => {
        const next: FocusLayout = [
            { id: "todo", taskIds: ["a"] },
            { id: "doing", taskIds: [] },
            { id: "done", taskIds: ["e", "f"] },
        ];
        expect(reconcileFocus(next, "d", { columnId: "doing", index: 1 })).toBe(
            "f",
        );
        const onlyLeft: FocusLayout = [
            { id: "todo", taskIds: ["a"] },
            { id: "doing", taskIds: [] },
        ];
        expect(
            reconcileFocus(onlyLeft, "d", { columnId: "doing", index: 0 }),
        ).toBe("a");
    });

    it("uses the first task when the column is gone or unknown", () => {
        expect(
            reconcileFocus(layout, "z", { columnId: "nope", index: 0 }),
        ).toBe("a");
        expect(reconcileFocus(layout, "z", null)).toBe("a");
    });

    it("returns null with no cursor or nothing visible", () => {
        expect(reconcileFocus(layout, null, null)).toBeNull();
        expect(
            reconcileFocus([{ id: "todo", taskIds: [] }], "a", {
                columnId: "todo",
                index: 0,
            }),
        ).toBeNull();
    });
});

describe("tabStopId", () => {
    it("is the cursor when visible, else the first task", () => {
        expect(tabStopId(layout, "e")).toBe("e");
        expect(tabStopId(layout, "gone")).toBe("a");
        expect(tabStopId(layout, null)).toBe("a");
        expect(tabStopId([], null)).toBeNull();
    });
});

describe("planReorder / planColumnStep", () => {
    it("moves one visible slot within the column", () => {
        expect(planReorder(layout, "b", 1)).toEqual({
            columnId: "todo",
            visibleIndex: 2,
        });
        expect(planReorder(layout, "b", -1)).toEqual({
            columnId: "todo",
            visibleIndex: 0,
        });
        expect(planReorder(layout, "c", 1)).toBeNull();
        expect(planReorder(layout, "a", -1)).toBeNull();
        expect(planReorder(layout, "gone", 1)).toBeNull();
    });

    it("steps to adjacent columns, including empty ones, keeping the row", () => {
        const order = layout.map((c) => c.id);
        expect(planColumnStep(order, layout, "c", 1)).toEqual({
            columnId: "empty",
            visibleIndex: 0,
        });
        expect(planColumnStep(order, layout, "f", -1)).toEqual({
            columnId: "doing",
            visibleIndex: 1,
        });
        expect(planColumnStep(order, layout, "e", -1)).toEqual({
            columnId: "doing",
            visibleIndex: 0,
        });
        expect(planColumnStep(order, layout, "a", -1)).toBeNull();
        expect(planColumnStep(order, layout, "f", 1)).toBeNull();
    });
});

describe("applyMove", () => {
    const t = (id: string, column_id: string, sort_order: number) => ({
        id,
        column_id,
        sort_order,
    });
    const columns = () => ({
        todo: [t("a", "todo", 1), t("b", "todo", 2), t("c", "todo", 3)],
        done: [t("e", "done", 10), t("f", "done", 20)],
    });
    const ids = (list: { id: string }[]) => list.map((x) => x.id);

    it("reorders within a column with a midpoint sort order", () => {
        // ⇧J on "a": one slot down, between "b" and "c".
        const result = applyMove(columns(), "a", {
            columnId: "todo",
            visibleIndex: 1,
        })!;
        expect(ids(result.columns.todo)).toEqual(["b", "a", "c"]);
        expect(result.sortOrder).toBe(2.5);
        expect(result.columns.todo[1].sort_order).toBe(2.5);
        expect(result.fromColumnId).toBe("todo");
    });

    it("moves to the end of a column", () => {
        const result = applyMove(columns(), "c", {
            columnId: "todo",
            visibleIndex: 2,
        })!;
        expect(ids(result.columns.todo)).toEqual(["a", "b", "c"]);
        expect(result.sortOrder).toBe(3);
    });

    it("moves across columns at a visible index, updating the column", () => {
        const result = applyMove(columns(), "b", {
            columnId: "done",
            visibleIndex: 1,
        })!;
        expect(ids(result.columns.todo)).toEqual(["a", "c"]);
        expect(ids(result.columns.done)).toEqual(["e", "b", "f"]);
        expect(result.sortOrder).toBe(15);
        expect(result.columns.done[1].column_id).toBe("done");
    });

    it("appends with a null visible index", () => {
        const result = applyMove(columns(), "a", {
            columnId: "done",
            visibleIndex: null,
        })!;
        expect(ids(result.columns.done)).toEqual(["e", "f", "a"]);
        expect(result.sortOrder).toBe(21);
    });

    it("into an empty column", () => {
        const result = applyMove({ ...columns(), empty: [] }, "a", {
            columnId: "empty",
            visibleIndex: 0,
        })!;
        expect(ids(result.columns.empty)).toEqual(["a"]);
        expect(result.sortOrder).toBe(1);
    });

    it("keeps hidden (filtered-out) tasks in place", () => {
        // "b" is hidden; moving "c" up one visible slot lands before "a".
        const visible = (task: { id: string }) => task.id !== "b";
        const up = applyMove(
            columns(),
            "c",
            { columnId: "todo", visibleIndex: 0 },
            visible,
        )!;
        expect(ids(up.columns.todo)).toEqual(["c", "a", "b"]);
        expect(up.sortOrder).toBe(0);

        // Moving "a" down one visible slot goes after "c", past hidden "b".
        const down = applyMove(
            columns(),
            "a",
            { columnId: "todo", visibleIndex: 1 },
            visible,
        )!;
        expect(ids(down.columns.todo)).toEqual(["b", "c", "a"]);
        expect(down.sortOrder).toBe(4);
    });

    it("returns null for unknown tasks or columns", () => {
        expect(
            applyMove(columns(), "zzz", { columnId: "todo", visibleIndex: 0 }),
        ).toBeNull();
        expect(
            applyMove(columns(), "a", { columnId: "nope", visibleIndex: 0 }),
        ).toBeNull();
    });
});
