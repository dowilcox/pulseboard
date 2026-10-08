import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
    daysUntil,
    formatDueDate,
    formatTimestamp,
    isDueSoon,
    isOverdue,
    parseDateOnly,
    toDateOnlyString,
} from "./formatTimestamp";

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

describe("parseDateOnly", () => {
    it("parses a calendar date as local midnight, not UTC", () => {
        const date = parseDateOnly("2026-03-24");
        expect(date.getFullYear()).toBe(2026);
        expect(date.getMonth()).toBe(2);
        expect(date.getDate()).toBe(24);
        expect(date.getHours()).toBe(0);
    });

    it("ignores any time component on a date-only value", () => {
        expect(parseDateOnly("2026-03-24T00:00:00.000000Z").getDate()).toBe(24);
    });

    it("round-trips through toDateOnlyString", () => {
        expect(toDateOnlyString(parseDateOnly("2026-12-05"))).toBe(
            "2026-12-05",
        );
    });
});

describe("formatDueDate", () => {
    it("formats the calendar day regardless of timezone", () => {
        expect(formatDueDate("2026-04-01")).toBe(
            new Date(2026, 3, 1).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
            }),
        );
    });

    it("includes the year when requested", () => {
        expect(formatDueDate("2026-04-01", { includeYear: true })).toBe(
            new Date(2026, 3, 1).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
                year: "numeric",
            }),
        );
    });
});

describe("due date helpers", () => {
    const now = new Date(2026, 3, 20, 23, 30);

    it("counts whole calendar days until a due date", () => {
        expect(daysUntil("2026-04-20", now)).toBe(0);
        expect(daysUntil("2026-04-21", now)).toBe(1);
        expect(daysUntil("2026-04-19", now)).toBe(-1);
    });

    it("treats a task due today as not overdue", () => {
        expect(isOverdue("2026-04-20", now)).toBe(false);
        expect(isOverdue("2026-04-19", now)).toBe(true);
    });

    it("flags tasks due within the window as due soon", () => {
        expect(isDueSoon("2026-04-20", 2, now)).toBe(true);
        expect(isDueSoon("2026-04-22", 2, now)).toBe(true);
        expect(isDueSoon("2026-04-23", 2, now)).toBe(false);
        expect(isDueSoon("2026-04-19", 2, now)).toBe(false);
    });
});
