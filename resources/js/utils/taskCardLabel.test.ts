import { describe, expect, it } from "vitest";
import type { Task } from "@/types";
import { formatDueDate } from "./formatTimestamp";
import { describeDueDate, describeTaskCard } from "./taskCardLabel";

const NOW = new Date(2026, 2, 20, 15, 0); // Mar 20 2026, local afternoon

const task = (overrides: Partial<Task>): Task =>
    ({
        id: "t1",
        board_id: "b",
        column_id: "c",
        task_number: 8,
        title: "Add search functionality",
        priority: "none",
        sort_order: 1,
        custom_fields: {},
        created_by: "u",
        created_at: "",
        updated_at: "",
        ...overrides,
    }) as Task;

describe("describeTaskCard", () => {
    it("reads number and title alone for a bare task", () => {
        expect(describeTaskCard(task({}), NOW)).toBe(
            "#8 Add search functionality",
        );
    });

    it("lists every visible detail once, in order", () => {
        const label = describeTaskCard(
            task({
                priority: "high",
                due_date: "2026-03-24",
                comments_count: 5,
                assignees: [
                    { id: "a", name: "Alice Admin" },
                    { id: "e", name: "Eve Evans" },
                ] as Task["assignees"],
            }),
            NOW,
        );
        expect(label).toBe(
            `#8 Add search functionality, High priority, due ${formatDueDate("2026-03-24")}, 5 comments, assigned to Alice Admin, Eve Evans`,
        );
        expect(label.match(/priority/g)).toHaveLength(1);
    });

    it("describes status, labels, progress and effort", () => {
        const label = describeTaskCard(
            task({
                completed_at: "2026-03-01T00:00:00Z",
                blocked_by: [{ id: "x" }] as Task["blocked_by"],
                labels: [
                    { id: "l1", name: "Bug" },
                    { id: "l2", name: "Frontend" },
                ] as Task["labels"],
                checklist_progress: { completed: 2, total: 5 },
                subtasks_count: 3,
                completed_subtasks_count: 1,
                comments_count: 1,
                effort_estimate: 1,
                gitlab_refs: [
                    {
                        id: "r",
                        ref_type: "merge_request",
                        gitlab_iid: 12,
                        state: "merged",
                    },
                ] as Task["gitlab_refs"],
            }),
            NOW,
        );
        expect(label).toBe(
            "#8 Add search functionality, completed, blocked, labels Bug, Frontend, merge request !12 merged, checklist 2 of 5, 1 of 3 subtasks done, 1 comment, 1 point",
        );
    });
});

describe("describeDueDate", () => {
    it("names today, tomorrow and overdue dates", () => {
        expect(describeDueDate("2026-03-20", false, NOW)).toBe("due today");
        expect(describeDueDate("2026-03-21", false, NOW)).toBe("due tomorrow");
        expect(describeDueDate("2026-03-19", false, NOW)).toBe(
            `overdue, due ${formatDueDate("2026-03-19")}`,
        );
    });

    it("never calls a completed task overdue", () => {
        expect(describeDueDate("2026-03-19", true, NOW)).toBe(
            `due ${formatDueDate("2026-03-19")}`,
        );
    });
});
