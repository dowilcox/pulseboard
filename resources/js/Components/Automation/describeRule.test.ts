import { describe, expect, it } from "vitest";
import { describeRule, type RuleSegment } from "./describeRule";

const lookups = {
    columns: [
        { id: "col-todo", name: "To Do" },
        { id: "col-review", name: "In Review" },
    ],
    members: [{ id: "user-bob", name: "Bob Builder" }],
    labels: [{ id: "label-bug", name: "Bug" }],
};

const text = (segments: RuleSegment[]) =>
    segments.map((s) => (s.strong ? `**${s.text}**` : s.text)).join("");

const describe_ = (
    trigger_type: string,
    trigger_config: Record<string, unknown>,
    action_type: string,
    action_config: Record<string, unknown>,
) => {
    const { trigger, action } = describeRule(
        { trigger_type, trigger_config, action_type, action_config },
        lookups,
    );
    return `When ${text(trigger)} → ${text(action)}`;
};

describe("describeRule", () => {
    it("names the columns and people involved", () => {
        expect(
            describe_(
                "task_moved",
                { to_column_id: "col-review" },
                "assign_user",
                { user_id: "user-bob" },
            ),
        ).toBe("When a task moves to **In Review** → assign **Bob Builder**");
    });

    it("describes from/to moves and labels", () => {
        expect(
            describe_(
                "task_moved",
                { from_column_id: "col-todo", to_column_id: "col-review" },
                "add_label",
                { label_id: "label-bug" },
            ),
        ).toBe(
            "When a task moves from **To Do** to **In Review** → add the **Bug** label",
        );
    });

    it("falls back to generic wording when a trigger has no filter", () => {
        expect(
            describe_("task_assigned", {}, "move_to_column", {
                column_id: "col-todo",
            }),
        ).toBe("When a task is assigned to anyone → move it to **To Do**");
    });

    it("marks references to deleted records", () => {
        expect(
            describe_("label_added", { label_id: "gone" }, "move_to_column", {
                column_id: "gone",
            }),
        ).toBe(
            "When the **(deleted label)** label is added → move it to **(deleted column)**",
        );
    });

    it("describes field updates with units", () => {
        expect(
            describe_("task_created", {}, "update_field", {
                field: "effort_estimate",
                value: "3",
            }),
        ).toBe("When a task is created → set effort to **3 points**");
        expect(
            describe_(
                "priority_changed",
                { priority: "urgent" },
                "update_field",
                {
                    field: "priority",
                    value: "high",
                },
            ),
        ).toBe(
            "When a task’s priority changes to **Urgent** → set priority to **High**",
        );
    });

    it("describes notification targets", () => {
        expect(
            describe_("comment_added", {}, "send_notification", {
                target: "watchers",
            }),
        ).toBe("When a comment is added → notify **all watchers**");
        expect(
            describe_("comment_added", {}, "send_notification", {
                target: "user-bob",
            }),
        ).toBe("When a comment is added → notify **Bob Builder**");
    });
});
