import { describe, expect, it } from "vitest";
import {
    boardProgressPercent,
    completedDelta,
    describeActivity,
    describeDueDate,
    groupDeadlines,
    orderDashboardBoards,
    sortTasksByPriority,
    statusKey,
} from "./dashboardUtils";

// Local noon on Wed 8 Oct 2026, so day arithmetic is timezone-safe.
const NOW = new Date(2026, 9, 8, 12, 0, 0);

describe("orderDashboardBoards", () => {
    const boards = ["a", "b", "c", "d", "e"].map((id) => ({ id }));

    it("keeps server order when nothing is starred or recent", () => {
        expect(orderDashboardBoards(boards).map((b) => b.id)).toEqual([
            "a",
            "b",
            "c",
            "d",
            "e",
        ]);
    });

    it("puts starred first, then recent, then the rest", () => {
        const ordered = orderDashboardBoards(
            boards,
            ["d", "b"],
            ["e", "b", "c"],
        );
        expect(ordered.map((b) => b.id)).toEqual(["d", "b", "e", "c", "a"]);
    });

    it("ignores ids that aren't in the board list", () => {
        const ordered = orderDashboardBoards(boards, ["zz"], ["yy", "c"]);
        expect(ordered.map((b) => b.id)).toEqual(["c", "a", "b", "d", "e"]);
    });
});

describe("boardProgressPercent", () => {
    it("is 0 for an empty board", () => {
        expect(boardProgressPercent({ done_tasks: 0, total_tasks: 0 })).toBe(0);
    });

    it("rounds done over total", () => {
        expect(boardProgressPercent({ done_tasks: 1, total_tasks: 3 })).toBe(
            33,
        );
        expect(boardProgressPercent({ done_tasks: 4, total_tasks: 4 })).toBe(
            100,
        );
    });
});

describe("completedDelta", () => {
    it("returns null when both windows are empty", () => {
        expect(completedDelta(0, 0)).toBeNull();
    });

    it("describes increases, decreases and no change", () => {
        expect(completedDelta(5, 2)).toEqual({
            text: "+3 vs previous 7 days",
            tone: "up",
        });
        expect(completedDelta(1, 4)).toEqual({
            text: "−3 vs previous 7 days",
            tone: "down",
        });
        expect(completedDelta(2, 2)).toEqual({
            text: "Same as previous 7 days",
            tone: "flat",
        });
    });
});

describe("sortTasksByPriority", () => {
    it("sorts by priority, then due date with undated last", () => {
        const tasks = [
            { id: "1", priority: "low" as const, due_date: "2026-10-09" },
            { id: "2", priority: "urgent" as const, due_date: undefined },
            { id: "3", priority: "urgent" as const, due_date: "2026-10-20" },
            { id: "4", priority: "none" as const, due_date: "2026-10-01" },
            { id: "5", priority: "high" as const, due_date: "2026-10-10" },
        ];
        expect(sortTasksByPriority(tasks).map((t) => t.id)).toEqual([
            "3",
            "2",
            "5",
            "1",
            "4",
        ]);
    });
});

describe("groupDeadlines", () => {
    it("separates overdue from due soon and treats today as not overdue", () => {
        const tasks = [
            { id: "today", due_date: "2026-10-08" },
            { id: "yesterday", due_date: "2026-10-07" },
            { id: "last-month", due_date: "2026-09-01" },
            { id: "in-14", due_date: "2026-10-22" },
            { id: "in-15", due_date: "2026-10-23" },
            { id: "undated", due_date: undefined },
            { id: "tomorrow", due_date: "2026-10-09" },
        ];
        const { overdue, dueSoon } = groupDeadlines(tasks, 14, NOW);
        expect(overdue.map((t) => t.id)).toEqual(["last-month", "yesterday"]);
        expect(dueSoon.map((t) => t.id)).toEqual([
            "today",
            "tomorrow",
            "in-14",
        ]);
    });
});

describe("describeDueDate", () => {
    it("labels overdue, today, tomorrow and later dates", () => {
        expect(describeDueDate("2026-10-05", NOW)).toMatchObject({
            relative: "3 days overdue",
            tone: "overdue",
        });
        expect(describeDueDate("2026-10-07", NOW).relative).toBe(
            "1 day overdue",
        );
        expect(describeDueDate("2026-10-08", NOW)).toMatchObject({
            date: "Today",
            tone: "today",
        });
        expect(describeDueDate("2026-10-09", NOW)).toMatchObject({
            date: "Tomorrow",
            tone: "soon",
        });
        expect(describeDueDate("2026-10-13", NOW)).toMatchObject({
            relative: "Due in 5 days",
            tone: "soon",
        });
        expect(describeDueDate("2026-11-30", NOW).tone).toBe("later");
    });

    it("includes the year for dates in another year", () => {
        expect(describeDueDate("2027-01-15", NOW).date).toMatch(/2027/);
        expect(describeDueDate("2026-11-30", NOW).date).not.toMatch(/2026/);
    });
});

describe("statusKey", () => {
    it("maps columns to status pills", () => {
        expect(statusKey({ name: "Shipped", is_done_column: true })).toBe(
            "done",
        );
        expect(statusKey({ name: "In Review", is_done_column: false })).toBe(
            "inProgress",
        );
        expect(statusKey({ name: "Backlog", is_done_column: false })).toBe(
            "backlog",
        );
        expect(statusKey({ name: "To Do", is_done_column: false })).toBe(
            "todo",
        );
    });
});

describe("describeActivity", () => {
    it("describes moves between columns and boards", () => {
        expect(
            describeActivity("moved", {
                from_column: "To Do",
                to_column: "Done",
            }),
        ).toEqual({ before: "moved", after: "from To Do to Done" });
        expect(
            describeActivity("moved", {
                from_board: "A",
                to_board: "B",
                to_column: "Done",
            }),
        ).toEqual({ before: "moved", after: "to the B board" });
        expect(
            describeActivity("moved", {
                auto_moved: true,
                from_column: "Doing",
                to_column: "Done",
            }).before,
        ).toBe("auto-moved");
    });

    it("names assignees, labels and fields", () => {
        expect(describeActivity("assigned", { users: ["Bo", "Al"] })).toEqual({
            before: "assigned Bo and Al to",
            after: "",
        });
        expect(describeActivity("labels_changed", { added: ["Bug"] })).toEqual({
            before: "added label Bug to",
            after: "",
        });
        expect(
            describeActivity("field_changed", {
                fields: ["due_date", "priority", "title"],
            }).before,
        ).toBe("updated the due date, priority and title of");
    });

    it("falls back to a generic verb for unknown actions", () => {
        expect(describeActivity("something_new")).toEqual({
            before: "updated",
            after: "",
        });
    });
});
