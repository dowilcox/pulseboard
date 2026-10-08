import { describe, expect, it } from "vitest";
import type { Task, User } from "@/types";
import { computeWorkload } from "./workload";

const user = (id: string, name: string): User =>
    ({ id, name, email: `${id}@test` }) as User;

const alice = user("alice", "Alice Admin");
const eve = user("eve", "Eve Evans");
const bob = user("bob", "Bob Builder");

let n = 0;
const task = (overrides: Partial<Task>): Task =>
    ({
        id: `t${++n}`,
        board_id: "b",
        column_id: "todo",
        task_number: n,
        title: `Task ${n}`,
        priority: "none",
        sort_order: n,
        custom_fields: {},
        created_by: "x",
        created_at: "",
        updated_at: "",
        assignees: [],
        ...overrides,
    }) as Task;

describe("computeWorkload", () => {
    it("sums points, counting unestimated tasks as 0 and reporting them", () => {
        const { groups } = computeWorkload({
            tasks: [
                task({ assignees: [alice], effort_estimate: 5 }),
                task({ assignees: [alice], effort_estimate: 3 }),
                task({ assignees: [alice] }),
                task({ assignees: [alice], effort_estimate: 0 }),
            ],
            members: [alice],
            doneColumnIds: new Set(),
        });
        expect(groups).toHaveLength(1);
        expect(groups[0].points).toBe(8);
        expect(groups[0].unestimated).toBe(1);
        expect(groups[0].tasks).toHaveLength(4);
    });

    it("skips done-column and completed tasks", () => {
        const { groups, unassigned } = computeWorkload({
            tasks: [
                task({ assignees: [alice], column_id: "done" }),
                task({ assignees: [alice], completed_at: "2026-01-01" }),
                task({ column_id: "done" }),
            ],
            members: [alice],
            doneColumnIds: new Set(["done"]),
        });
        expect(groups).toHaveLength(0);
        expect(unassigned?.tasks).toHaveLength(0);
    });

    it("collects unassigned tasks and idle members", () => {
        const result = computeWorkload({
            tasks: [task({}), task({ assignees: [alice] })],
            members: [alice, eve, bob],
            doneColumnIds: new Set(),
        });
        expect(result.unassigned?.tasks).toHaveLength(1);
        expect(result.idleMembers.map((m) => m.name)).toEqual([
            "Bob Builder",
            "Eve Evans",
        ]);
    });

    it("counts shared tasks for each assignee and sorts heaviest first", () => {
        const { groups } = computeWorkload({
            tasks: [
                task({ assignees: [alice, eve], effort_estimate: 2 }),
                task({ assignees: [eve], effort_estimate: 8 }),
            ],
            members: [alice, eve],
            doneColumnIds: new Set(),
        });
        expect(groups.map((g) => [g.user?.name, g.points])).toEqual([
            ["Eve Evans", 10],
            ["Alice Admin", 2],
        ]);
    });

    it("limits groups to the filtered assignees", () => {
        const result = computeWorkload({
            tasks: [
                task({ assignees: [alice, eve], effort_estimate: 2 }),
                task({}),
            ],
            members: [alice, eve, bob],
            doneColumnIds: new Set(),
            onlyAssigneeIds: ["alice"],
        });
        expect(result.groups.map((g) => g.key)).toEqual(["alice"]);
        expect(result.unassigned).toBeNull();
        expect(result.idleMembers).toEqual([]);
    });

    it("orders tasks by priority, then due date", () => {
        const { groups } = computeWorkload({
            tasks: [
                task({ assignees: [alice], priority: "low", title: "low" }),
                task({
                    assignees: [alice],
                    priority: "urgent",
                    due_date: "2026-05-02",
                    title: "urgent later",
                }),
                task({
                    assignees: [alice],
                    priority: "urgent",
                    due_date: "2026-05-01",
                    title: "urgent sooner",
                }),
            ],
            members: [alice],
            doneColumnIds: new Set(),
        });
        expect(groups[0].tasks.map((t) => t.title)).toEqual([
            "urgent sooner",
            "urgent later",
            "low",
        ]);
        expect(groups[0].byPriority).toEqual({ urgent: 2, low: 1 });
    });
});
