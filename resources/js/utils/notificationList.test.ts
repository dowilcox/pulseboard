import { describe, expect, it } from "vitest";
import { appendPage, mergeFirstPage } from "./notificationList";

const n = (id: string, read = false) => ({ id, read });

describe("mergeFirstPage", () => {
    it("returns the first page when nothing is loaded", () => {
        expect(mergeFirstPage([n("a"), n("b")], [])).toEqual([n("a"), n("b")]);
    });

    it("prepends new items and keeps older loaded pages", () => {
        const loaded = [n("b"), n("c"), n("d")];
        expect(
            mergeFirstPage([n("a"), n("b"), n("c")], loaded).map((x) => x.id),
        ).toEqual(["a", "b", "c", "d"]);
    });

    it("replaces stale copies with fresh ones", () => {
        const merged = mergeFirstPage([n("a", true)], [n("a", false)]);
        expect(merged).toEqual([n("a", true)]);
    });
});

describe("appendPage", () => {
    it("appends unseen items in order", () => {
        expect(
            appendPage([n("a"), n("b")], [n("c"), n("d")]).map((x) => x.id),
        ).toEqual(["a", "b", "c", "d"]);
    });

    it("skips items repeated because pages shifted", () => {
        expect(
            appendPage([n("a"), n("b")], [n("b"), n("c")]).map((x) => x.id),
        ).toEqual(["a", "b", "c"]);
    });
});
