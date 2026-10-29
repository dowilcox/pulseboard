import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
    adjacentTask,
    loadTaskNavOrder,
    resetTaskNavMemory,
    saveTaskNavOrder,
    setReturnFocus,
} from "./taskNavigation";

const e = (id: string) => ({ id, slug: `${id}-slug` });

describe("adjacentTask", () => {
    const groups = [[e("a"), e("b"), e("c")], [e("d")]];

    it("finds neighbours within the task's own group", () => {
        expect(adjacentTask(groups, "b", 1)).toEqual(e("c"));
        expect(adjacentTask(groups, "b", -1)).toEqual(e("a"));
    });

    it("stops at the ends of a group (no hopping columns)", () => {
        expect(adjacentTask(groups, "c", 1)).toBeNull();
        expect(adjacentTask(groups, "d", -1)).toBeNull();
        expect(adjacentTask(groups, "a", -1)).toBeNull();
    });

    it("is null for tasks not in the order", () => {
        expect(adjacentTask(groups, "zzz", 1)).toBeNull();
    });
});

function memoryStorage() {
    const store = new Map<string, string>();
    return {
        getItem: vi.fn((key: string) => store.get(key) ?? null),
        setItem: vi.fn(
            (key: string, value: string) => void store.set(key, value),
        ),
        removeItem: vi.fn((key: string) => void store.delete(key)),
        clear: () => store.clear(),
    };
}

describe("saved order", () => {
    let storage: ReturnType<typeof memoryStorage>;

    beforeEach(() => {
        storage = memoryStorage();
        vi.stubGlobal("sessionStorage", storage);
    });

    afterEach(() => {
        resetTaskNavMemory();
        vi.unstubAllGlobals();
    });

    const order = {
        boardId: "board-1",
        url: "/team/board?view=list",
        groups: [[e("a"), e("b")]],
        returnFocusId: null,
    };

    it("round-trips through sessionStorage", () => {
        saveTaskNavOrder(order);
        resetTaskNavMemory();
        expect(loadTaskNavOrder()).toEqual(order);
    });

    it("records the return focus for the same board only", () => {
        saveTaskNavOrder(order);
        setReturnFocus("other-board", "b");
        expect(loadTaskNavOrder()?.returnFocusId).toBeNull();
        setReturnFocus("board-1", "b");
        expect(loadTaskNavOrder()?.returnFocusId).toBe("b");
    });

    it("ignores unreadable storage and keeps working in memory", () => {
        storage.setItem.mockImplementation(() => {
            throw new Error("quota");
        });
        expect(() => saveTaskNavOrder(order)).not.toThrow();
        expect(loadTaskNavOrder()).toEqual(order);

        resetTaskNavMemory();
        storage.getItem.mockReturnValue("{not json");
        expect(loadTaskNavOrder()).toBeNull();
    });
});
