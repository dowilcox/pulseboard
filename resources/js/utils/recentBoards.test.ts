import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getRecentBoardIds, pushRecentBoard } from "./recentBoards";

// Newer Node versions ship an experimental global `localStorage` that shadows
// jsdom's and is unusable without --localstorage-file, so stub one in memory.
function memoryStorage(): Storage {
    const store = new Map<string, string>();
    return {
        get length() {
            return store.size;
        },
        clear: () => store.clear(),
        getItem: (key) => store.get(key) ?? null,
        key: (index) => [...store.keys()][index] ?? null,
        removeItem: (key) => void store.delete(key),
        setItem: (key, value) => void store.set(key, String(value)),
    };
}

describe("recentBoards", () => {
    beforeEach(() => {
        vi.stubGlobal("localStorage", memoryStorage());
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("returns an empty list when nothing is stored", () => {
        expect(getRecentBoardIds()).toEqual([]);
    });

    it("moves a revisited board to the front without duplicates", () => {
        pushRecentBoard("a");
        pushRecentBoard("b");
        expect(pushRecentBoard("a")).toEqual(["a", "b"]);
        expect(getRecentBoardIds()).toEqual(["a", "b"]);
    });

    it("caps the list length", () => {
        for (let i = 0; i < 12; i++) pushRecentBoard(`board-${i}`);
        expect(getRecentBoardIds()).toHaveLength(8);
        expect(getRecentBoardIds()[0]).toBe("board-11");
    });

    it("ignores corrupt storage", () => {
        localStorage.setItem("pulseboard-recent-boards", "{not json");
        expect(getRecentBoardIds()).toEqual([]);
    });
});
