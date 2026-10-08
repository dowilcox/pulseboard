import type { AutomationRule } from "@/types";
import { formatDueDate } from "@/utils/formatTimestamp";

/** A run of summary text; `strong` marks a specific column/user/label/value. */
export interface RuleSegment {
    text: string;
    strong?: boolean;
}

export interface RuleLookups {
    columns: { id: string; name: string }[];
    members: { id: string; name: string }[];
    labels: { id: string; name: string }[];
}

export interface RuleDescription {
    trigger: RuleSegment[];
    action: RuleSegment[];
}

const PRIORITY_LABELS: Record<string, string> = {
    urgent: "Urgent",
    high: "High",
    medium: "Medium",
    low: "Low",
    none: "None",
};

const PIPELINE_LABELS: Record<string, string> = {
    success: "Success",
    failed: "Failed",
    canceled: "Canceled",
};

const NOTIFY_TARGETS: Record<string, string> = {
    assignees: "all assignees",
    watchers: "all watchers",
    creator: "the task creator",
};

const t = (text: string): RuleSegment => ({ text });
const s = (text: string): RuleSegment => ({ text, strong: true });

function str(config: Record<string, unknown>, key: string): string | null {
    const value = config?.[key];
    if (value === undefined || value === null || value === "") return null;
    return String(value);
}

function nameOf(
    list: { id: string; name: string }[],
    id: string,
    missing: string,
): string {
    return list.find((item) => item.id === id)?.name ?? missing;
}

/**
 * Plain-language summary of a rule, naming the columns, people, labels and
 * values involved, e.g. "When a task moves to **In Review** → assign **Bob**".
 */
export function describeRule(
    rule: Pick<
        AutomationRule,
        "trigger_type" | "trigger_config" | "action_type" | "action_config"
    >,
    { columns, members, labels }: RuleLookups,
): RuleDescription {
    const tc = rule.trigger_config ?? {};
    const ac = rule.action_config ?? {};
    const column = (id: string) => nameOf(columns, id, "(deleted column)");
    const member = (id: string) => nameOf(members, id, "(former member)");
    const label = (id: string) => nameOf(labels, id, "(deleted label)");

    return {
        trigger: describeTrigger(rule.trigger_type, tc, column, member, label),
        action: describeAction(rule.action_type, ac, column, member, label),
    };
}

function describeTrigger(
    type: string,
    config: Record<string, unknown>,
    column: (id: string) => string,
    member: (id: string) => string,
    label: (id: string) => string,
): RuleSegment[] {
    switch (type) {
        case "task_moved": {
            const from = str(config, "from_column_id");
            const to = str(config, "to_column_id");
            if (from && to) {
                return [
                    t("a task moves from "),
                    s(column(from)),
                    t(" to "),
                    s(column(to)),
                ];
            }
            if (to) return [t("a task moves to "), s(column(to))];
            if (from) return [t("a task moves out of "), s(column(from))];
            return [t("a task moves to another column")];
        }
        case "task_created":
            return [t("a task is created")];
        case "task_completed":
            return [t("a task is completed")];
        case "task_uncompleted":
            return [t("a task is reopened")];
        case "task_assigned": {
            const user = str(config, "user_id");
            return user
                ? [t("a task is assigned to "), s(member(user))]
                : [t("a task is assigned to anyone")];
        }
        case "label_added": {
            const id = str(config, "label_id");
            return id
                ? [t("the "), s(label(id)), t(" label is added")]
                : [t("any label is added")];
        }
        case "priority_changed": {
            const priority = str(config, "priority");
            return priority
                ? [
                      t("a task’s priority changes to "),
                      s(PRIORITY_LABELS[priority] ?? priority),
                  ]
                : [t("a task’s priority changes")];
        }
        case "comment_added":
            return [t("a comment is added")];
        case "due_date_reached":
            return [t("a task reaches its due date")];
        case "gitlab_mr_merged":
            return [t("a linked GitLab merge request is merged")];
        case "gitlab_pipeline_status": {
            const status = str(config, "status");
            return status
                ? [
                      t("a GitLab pipeline finishes as "),
                      s(PIPELINE_LABELS[status] ?? status),
                  ]
                : [t("a GitLab pipeline finishes")];
        }
        default:
            return [t(type.replace(/_/g, " "))];
    }
}

function describeAction(
    type: string,
    config: Record<string, unknown>,
    column: (id: string) => string,
    member: (id: string) => string,
    label: (id: string) => string,
): RuleSegment[] {
    const user = str(config, "user_id");
    const labelId = str(config, "label_id");

    switch (type) {
        case "move_to_column": {
            const id = str(config, "column_id");
            return id
                ? [t("move it to "), s(column(id))]
                : [t("move it to another column")];
        }
        case "mark_complete":
            return [t("mark it complete")];
        case "mark_incomplete":
            return [t("mark it incomplete")];
        case "assign_user":
            return [t("assign "), s(user ? member(user) : "someone")];
        case "unassign_user":
            return [t("unassign "), s(user ? member(user) : "someone")];
        case "add_watcher":
            return [
                t("add "),
                s(user ? member(user) : "someone"),
                t(" as a watcher"),
            ];
        case "remove_watcher":
            return [
                t("remove "),
                s(user ? member(user) : "someone"),
                t(" as a watcher"),
            ];
        case "add_label":
            return [
                t("add the "),
                s(labelId ? label(labelId) : "selected"),
                t(" label"),
            ];
        case "remove_label":
            return [
                t("remove the "),
                s(labelId ? label(labelId) : "selected"),
                t(" label"),
            ];
        case "update_field": {
            const field = str(config, "field");
            const value = str(config, "value") ?? "";
            if (field === "priority") {
                return [
                    t("set priority to "),
                    s(PRIORITY_LABELS[value] ?? value),
                ];
            }
            if (field === "effort_estimate") {
                return [
                    t("set effort to "),
                    s(`${value} ${value === "1" ? "point" : "points"}`),
                ];
            }
            if (field === "due_date") {
                return [
                    t("set the due date to "),
                    s(
                        /^\d{4}-\d{2}-\d{2}/.test(value)
                            ? formatDueDate(value, { includeYear: true })
                            : value,
                    ),
                ];
            }
            return [t("update a field")];
        }
        case "send_notification": {
            const target = str(config, "target") ?? "assignees";
            return [t("notify "), s(NOTIFY_TARGETS[target] ?? member(target))];
        }
        default:
            return [t(type.replace(/_/g, " "))];
    }
}
