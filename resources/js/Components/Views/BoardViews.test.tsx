import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
    cleanup,
    fireEvent,
    render,
    screen,
    within,
} from "@testing-library/react";
import type { Column, Task, User } from "@/types";
import { EMPTY_FILTERS, createTaskFilter } from "@/utils/boardFilters";
import KanbanView from "./KanbanView";
import ListView from "./ListView";
import WorkloadView from "./WorkloadView";
import FilterBar from "@/Components/Tasks/FilterBar";

const alice = { id: "alice", name: "Alice Admin" } as User;
const eve = { id: "eve", name: "Eve Evans" } as User;

let n = 0;
function task(overrides: Partial<Task>): Task {
    n += 1;
    return {
        id: `t${n}`,
        board_id: "b",
        column_id: "backlog",
        task_number: n,
        slug: `${n}-task`,
        title: `Task ${n}`,
        priority: "none",
        sort_order: n,
        custom_fields: {},
        created_by: "u",
        created_at: "",
        updated_at: "",
        assignees: [],
        labels: [],
        ...overrides,
    } as Task;
}

function column(overrides: Partial<Column>): Column {
    return {
        id: "backlog",
        board_id: "b",
        name: "Backlog",
        color: "",
        sort_order: 0,
        is_done_column: false,
        created_at: "",
        updated_at: "",
        tasks: [],
        tasks_count: 0,
        ...overrides,
    } as Column;
}

beforeEach(() => {
    vi.stubGlobal(
        "route",
        (name: string, params: unknown[] | string = []) =>
            `/${name}/${([] as unknown[]).concat(params).join("/")}`,
    );
    vi.stubGlobal(
        "IntersectionObserver",
        class {
            observe() {}
            disconnect() {}
        },
    );
});

afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
});

describe("KanbanView", () => {
    it("shows honest filtered counts and renders cards as links", () => {
        const mine = task({
            title: "Add search functionality",
            priority: "high",
            assignees: [alice],
        });
        const others = [task({}), task({})];
        const columns = [
            column({ tasks: [mine, ...others], tasks_count: 6 }),
            column({
                id: "doing",
                name: "Doing",
                wip_limit: 2,
                tasks: [
                    task({ column_id: "doing" }),
                    task({ column_id: "doing" }),
                ],
                tasks_count: 2,
            }),
        ];
        const filterFn = createTaskFilter({
            ...EMPTY_FILTERS,
            assignees: ["alice"],
        });

        render(
            <KanbanView
                columns={columns}
                board={{ id: "b", slug: "sprint" }}
                team={{ id: "t", slug: "eng" }}
                filterFn={filterFn}
                filtersActive
            />,
        );

        const backlog = screen.getByRole("region", {
            name: "Backlog column, showing 1 of 6 tasks",
        });
        expect(within(backlog).getByText("1 of 6")).toBeInTheDocument();

        const link = within(backlog).getByRole("link", {
            name: /Add search functionality, High priority, assigned to Alice Admin$/,
        });
        expect(link).toHaveAttribute(
            "href",
            `/tasks.show/eng/sprint/${mine.slug}`,
        );

        const doing = screen.getByRole("region", {
            name: "Doing column, showing 0 of 2 tasks, WIP limit 2, at limit",
        });
        expect(within(doing).getByText("2/2 WIP")).toBeInTheDocument();
        expect(
            within(doing).getByRole("button", { name: "Add task to Doing" }),
        ).toHaveAttribute("aria-disabled", "true");
    });

    it("opens the quick-create form at the top of a column", () => {
        render(
            <KanbanView
                columns={[column({ tasks: [task({})], tasks_count: 1 })]}
                board={{ id: "b", slug: "sprint" }}
                team={{ id: "t", slug: "eng" }}
                filterFn={() => true}
            />,
        );
        fireEvent.click(
            screen.getByRole("button", { name: "Add task to Backlog" }),
        );
        expect(
            screen.getByRole("textbox", { name: "New task title in Backlog" }),
        ).toHaveFocus();
    });
});

describe("ListView", () => {
    it("reports how many tasks are shown of the board total", () => {
        const tasks = [
            task({ assignees: [eve] }),
            task({ assignees: [alice] }),
            task({}),
        ];
        const { rerender } = render(
            <ListView
                columns={[column({ tasks_count: 3 })]}
                team={{ slug: "eng" }}
                board={{ slug: "sprint", name: "Sprint" }}
                tasks={tasks}
                complete
                loading={false}
                filterFn={createTaskFilter({
                    ...EMPTY_FILTERS,
                    assignees: ["alice"],
                })}
                filtersActive
                onClearFilters={() => {}}
            />,
        );
        expect(screen.getByText("Showing 1 of 3 tasks")).toBeInTheDocument();

        rerender(
            <ListView
                columns={[column({ tasks_count: 3 })]}
                team={{ slug: "eng" }}
                board={{ slug: "sprint", name: "Sprint" }}
                tasks={tasks}
                complete
                loading={false}
                filterFn={() => true}
                filtersActive={false}
                onClearFilters={() => {}}
            />,
        );
        expect(screen.getByText("Showing all 3 tasks")).toBeInTheDocument();

        // Sort by assignee: first assignee's name, unassigned last
        fireEvent.click(screen.getByRole("button", { name: "Assignees" }));
        const rows = screen.getAllByRole("row").slice(1);
        expect(rows.map((r) => r.textContent)).toEqual([
            expect.stringContaining("Alice Admin"),
            expect.stringContaining("Eve Evans"),
            expect.not.stringContaining("Admin"),
        ]);
    });
});

describe("WorkloadView", () => {
    it("expands +N more inline and explains an assignee filter", () => {
        const tasks = Array.from({ length: 10 }, () =>
            task({ assignees: [alice], effort_estimate: 2 }),
        );
        tasks.push(task({ assignees: [alice] }));
        const onShowEveryone = vi.fn();

        render(
            <WorkloadView
                columns={[column({})]}
                members={[alice, eve]}
                tasks={tasks}
                complete
                loading={false}
                filterFn={() => true}
                filtersActive
                assigneeIds={["alice"]}
                otherFiltersActive={false}
                onShowEveryone={onShowEveryone}
                taskHref={(t) => `/t/${t.id}`}
            />,
        );

        expect(
            screen.getByText("11 tasks · 20 points · 1 unestimated"),
        ).toBeInTheDocument();
        expect(screen.getAllByRole("link")).toHaveLength(8);
        fireEvent.click(screen.getByRole("button", { name: "Show 3 more" }));
        expect(screen.getAllByRole("link")).toHaveLength(11);

        expect(
            screen.getByText(/Showing only Alice Admin/),
        ).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "Show everyone" }));
        expect(onShowEveryone).toHaveBeenCalled();
    });
});

describe("FilterBar", () => {
    it("names the active saved filter and offers labelled controls", () => {
        const onClear = vi.fn();
        render(
            <FilterBar
                members={[alice, eve]}
                labels={[]}
                columns={[column({})]}
                filters={{
                    ...EMPTY_FILTERS,
                    assignees: ["alice"],
                    priorities: ["high"],
                }}
                onFiltersChange={() => {}}
                onClearFilters={onClear}
                savedFilters={[
                    {
                        id: "s1",
                        board_id: "b",
                        user_id: "alice",
                        name: "My Tasks",
                        filter_config: {},
                        is_default: true,
                        created_at: "",
                        updated_at: "",
                    },
                ]}
                activeSavedFilterId="s1"
                onApplySavedFilter={() => {}}
                onSavedFiltersChange={() => {}}
                teamSlug="eng"
                boardSlug="sprint"
                currentUserId="alice"
            />,
        );

        expect(screen.getByText("My Tasks")).toBeInTheDocument();
        expect(
            screen.getByRole("button", {
                name: "Assignee filter: Alice Admin",
            }),
        ).toBeInTheDocument();
        expect(
            screen.getByRole("button", { name: "Filters, 1 active" }),
        ).toBeInTheDocument();
        expect(screen.getByText("Priority: High")).toBeInTheDocument();
        expect(
            screen.getByRole("button", { name: "Saved filters" }),
        ).toBeInTheDocument();

        fireEvent.click(
            screen.getByRole("button", {
                name: "Remove saved filter My Tasks",
            }),
        );
        expect(onClear).toHaveBeenCalled();
        expect(
            screen.getByRole("button", { name: "Clear all" }),
        ).toBeInTheDocument();
    });
});
