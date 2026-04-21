import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { formatTimestamp } from "./formatTimestamp";

describe("formatTimestamp", () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-04-20T16:00:00.000Z"));
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("formats recent timestamps relatively", () => {
        expect(formatTimestamp("2026-04-20T15:59:45.000Z")).toBe("just now");
        expect(formatTimestamp("2026-04-20T15:20:00.000Z")).toBe("40m ago");
        expect(formatTimestamp("2026-04-20T12:00:00.000Z")).toBe("4h ago");
        expect(formatTimestamp("2026-04-18T16:00:00.000Z")).toBe("2d ago");
    });

    it("falls back to locale dates after a week", () => {
        expect(formatTimestamp("2026-04-01T16:00:00.000Z")).toBe(
            new Date("2026-04-01T16:00:00.000Z").toLocaleDateString(),
        );
    });
});
