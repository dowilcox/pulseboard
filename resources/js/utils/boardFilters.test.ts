import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Task } from "@/types";
import {
    EMPTY_FILTERS,
    buildBoardSearch,
    columnCountSummary,
    countPopoverFilters,
    createTaskFilter,
    filtersEqual,
    filtersToConfig,
    getStoredBoardView,
    listFooterText,
    normalizeFilterConfig,
    parseBoardSearch,
    resolveBoardState,
    storeBoardView,
    withFilters,
    type BoardFilters,
    type BoardState,
} from "./boardFilters";

const ALICE = "6f1c2a9e-0000-4000-8000-000000000001";
const EVE = "6f1c2a9e-0000-4000-8000-000000000002";

function filters(overrides: Partial<BoardFilters> = {}): BoardFilters {
    return { ...EMPTY_FILTERS, ...overrides };
}

function state(overrides: Partial<BoardState> = {}): BoardState {
    return {
        view: "kanban",
        filters: EMPTY_FILTERS,
        savedFilterId: null,
        cleared: false,
        ...overrides,
    };
}

const myTasks = {
    id: "saved-my",
    filter_config: { assignees: [ALICE] },
    is_default: true,
};
const highPriority = {
    id: "saved-high",
    filter_config: { priorities: ["urgent", "high"] },
    is_default: false,
};

describe("parseBoardSearch", () => {
    it("reads view and every filter param", () => {
        const parsed = parseBoardSearch(
            `?view=list&q=login%20bug&assignees=${ALICE},${EVE}&labels=l1&priority=high,urgent&columns=c1,c2&due_from=2026-03-01&due_to=2026-03-31&saved=s1`,
        );
        expect(parsed.view).toBe("list");
        expect(parsed.savedFilterId).toBe("s1");
        expect(parsed.hasFilterParams).toBe(true);
        expect(parsed.filters).toEqual({
            search: "login bug",
            assignees: [ALICE, EVE],
            labels: ["l1"],
            priorities: ["high", "urgent"],
            columns: ["c1", "c2"],
            dueDateFrom: "2026-03-01",
            dueDateTo: "2026-03-31",
        });
    });

    it("accepts board and kanban as the Kanban view", () => {
        expect(parseBoardSearch("?view=board").view).toBe("kanban");
        expect(parseBoardSearch("view=kanban").view).toBe("kanban");
        expect(parseBoardSearch("?view=gantt").view).toBeNull();
    });

    it("drops invalid priorities and malformed dates", () => {
        const parsed = parseBoardSearch(
            "?priority=high,critical&due_from=tomorrow&due_to=2026-3-1",
        );
        expect(parsed.filters.priorities).toEqual(["high"]);
        expect(parsed.filters.dueDateFrom).toBe("");
        expect(parsed.filters.dueDateTo).toBe("");
    });

    it("dedupes lists and ignores empty items", () => {
        expect(parseBoardSearch("?labels=a,,a,b,").filters.labels).toEqual([
            "a",
            "b",
        ]);
    });

    it("recognises the explicit cleared marker", () => {
        const parsed = parseBoardSearch("?filter=none");
        expect(parsed.cleared).toBe(true);
        expect(parsed.hasFilterParams).toBe(false);
    });
});

describe("buildBoardSearch", () => {
    it("serializes a state with readable comma lists", () => {
        const search = buildBoardSearch(
            "",
            state({
                view: "list",
                savedFilterId: "s1",
                filters: filters({
                    search: "login bug",
                    assignees: [ALICE, EVE],
                    priorities: ["high", "urgent"],
                    dueDateFrom: "2026-03-01",
                }),
            }),
        );
        expect(search).toBe(
            `?view=list&saved=s1&q=login%20bug&assignees=${ALICE},${EVE}&priority=high,urgent&due_from=2026-03-01`,
        );
    });

    it("writes board for Kanban and filter=none when cleared", () => {
        expect(buildBoardSearch("", state({ cleared: true }))).toBe(
            "?view=board&filter=none",
        );
    });

    it("never writes saved or filter=none alongside the wrong state", () => {
        expect(
            buildBoardSearch(
                "",
                state({ savedFilterId: "s1", filters: EMPTY_FILTERS }),
            ),
        ).toBe("?view=board");
        expect(
            buildBoardSearch(
                "",
                state({ cleared: true, filters: filters({ search: "x" }) }),
            ),
        ).toBe("?view=board&q=x");
    });

    it("keeps unrelated params and replaces its own", () => {
        expect(
            buildBoardSearch(
                "?utm=mail&q=old&view=list",
                state({ filters: filters({ search: "new" }) }),
            ),
        ).toBe("?view=board&q=new&utm=mail");
    });

    it("round-trips through parseBoardSearch", () => {
        const original = state({
            view: "workload",
            filters: filters({
                search: "a,b & c",
                labels: ["l1", "l2"],
                columns: ["c1"],
                dueDateTo: "2026-12-31",
            }),
        });
        const parsed = parseBoardSearch(buildBoardSearch("", original));
        expect(parsed.view).toBe("workload");
        expect(parsed.filters).toEqual(original.filters);
    });
});

describe("resolveBoardState", () => {
    it("applies the default saved filter on a fresh entry", () => {
        const { state: s, syncUrl } = resolveBoardState(
            "",
            [highPriority, myTasks],
            null,
        );
        expect(s.filters.assignees).toEqual([ALICE]);
        expect(s.savedFilterId).toBe("saved-my");
        expect(s.view).toBe("kanban");
        expect(syncUrl).toBe(true);
    });

    it("does not re-apply the default after the user cleared filters", () => {
        const { state: s, syncUrl } = resolveBoardState(
            "?view=board&filter=none",
            [myTasks],
            null,
        );
        expect(s.filters).toEqual(EMPTY_FILTERS);
        expect(s.savedFilterId).toBeNull();
        expect(s.cleared).toBe(true);
        expect(syncUrl).toBe(false);
    });

    it("prefers explicit filter params over the default", () => {
        const { state: s } = resolveBoardState(
            "?priority=low",
            [myTasks],
            null,
        );
        expect(s.filters.priorities).toEqual(["low"]);
        expect(s.filters.assignees).toEqual([]);
        expect(s.savedFilterId).toBeNull();
    });

    it("names the saved filter only while params match it", () => {
        expect(
            resolveBoardState(
                "?saved=saved-high&priority=urgent,high",
                [highPriority],
                null,
            ).state.savedFilterId,
        ).toBe("saved-high");

        const modified = resolveBoardState(
            "?saved=saved-high&priority=urgent",
            [highPriority],
            null,
        );
        expect(modified.state.savedFilterId).toBeNull();
        expect(modified.syncUrl).toBe(true);
    });

    it("applies a saved filter referenced without params", () => {
        const { state: s, syncUrl } = resolveBoardState(
            "?saved=saved-high",
            [highPriority],
            null,
        );
        expect(s.filters.priorities).toEqual(["urgent", "high"]);
        expect(s.savedFilterId).toBe("saved-high");
        expect(syncUrl).toBe(true);
    });

    it("falls back to the stored view, then Kanban", () => {
        expect(resolveBoardState("", [], "workload").state.view).toBe(
            "workload",
        );
        expect(resolveBoardState("?view=list", [], "workload").state.view).toBe(
            "list",
        );
        expect(resolveBoardState("", [], null).state.view).toBe("kanban");
    });

    it("drops a reference to a deleted saved filter", () => {
        const { state: s, syncUrl } = resolveBoardState(
            "?saved=gone",
            [],
            null,
        );
        expect(s.savedFilterId).toBeNull();
        expect(syncUrl).toBe(true);
    });
});

describe("withFilters", () => {
    it("keeps the saved filter name while filters still match it", () => {
        const current = state({
            filters: normalizeFilterConfig(highPriority.filter_config),
            savedFilterId: "saved-high",
        });
        const reordered = withFilters(
            current,
            filters({ priorities: ["high", "urgent"] }),
            [highPriority],
        );
        expect(reordered.savedFilterId).toBe("saved-high");

        const changed = withFilters(
            current,
            filters({ priorities: ["high"] }),
            [highPriority],
        );
        expect(changed.savedFilterId).toBeNull();
        expect(changed.cleared).toBe(false);
    });

    it("records that filters were cleared", () => {
        const cleared = withFilters(
            state({ filters: filters({ search: "x" }) }),
            EMPTY_FILTERS,
            [],
        );
        expect(cleared.cleared).toBe(true);
    });
});

describe("saved filter config", () => {
    it("normalizes legacy and partial configs", () => {
        expect(
            normalizeFilterConfig({
                priority: "urgent",
                assignees: [ALICE, 5],
                dueDateFrom: "nope",
            }),
        ).toEqual(filters({ priorities: ["urgent"], assignees: [ALICE] }));
        expect(normalizeFilterConfig(null)).toEqual(EMPTY_FILTERS);
    });

    it("stores only non-empty keys", () => {
        expect(
            filtersToConfig(filters({ search: " a ", labels: ["l1"] })),
        ).toEqual({ search: "a", labels: ["l1"] });
    });

    it("compares filters as sets", () => {
        expect(
            filtersEqual(
                filters({ labels: ["a", "b"] }),
                filters({ labels: ["b", "a"] }),
            ),
        ).toBe(true);
        expect(
            filtersEqual(filters({ labels: ["a"] }), filters({ labels: [] })),
        ).toBe(false);
    });

    it("counts selections hidden in the Filters popover", () => {
        expect(
            countPopoverFilters(
                filters({
                    search: "ignored",
                    assignees: [ALICE],
                    labels: ["a", "b"],
                    priorities: ["high"],
                    dueDateTo: "2026-01-01",
                }),
            ),
        ).toBe(4);
    });
});

describe("createTaskFilter", () => {
    const task = (overrides: Partial<Task>): Task =>
        ({
            id: "t",
            board_id: "b",
            column_id: "c1",
            task_number: 8,
            title: "Add search functionality",
            priority: "high",
            sort_order: 1,
            custom_fields: {},
            created_by: "u",
            created_at: "",
            updated_at: "",
            assignees: [],
            labels: [],
            ...overrides,
        }) as Task;

    it("matches everything without filters", () => {
        expect(createTaskFilter(EMPTY_FILTERS)(task({}))).toBe(true);
    });

    it("searches titles and task numbers", () => {
        expect(createTaskFilter(filters({ search: "SEARCH" }))(task({}))).toBe(
            true,
        );
        expect(createTaskFilter(filters({ search: "#8" }))(task({}))).toBe(
            true,
        );
        expect(createTaskFilter(filters({ search: "9" }))(task({}))).toBe(
            false,
        );
    });

    it("filters by assignee, priority and column", () => {
        const assigned = task({
            assignees: [
                { id: ALICE, name: "Alice" } as Task["assignees"] & never,
            ],
        });
        expect(
            createTaskFilter(filters({ assignees: [ALICE] }))(assigned),
        ).toBe(true);
        expect(createTaskFilter(filters({ assignees: [EVE] }))(assigned)).toBe(
            false,
        );
        expect(
            createTaskFilter(filters({ priorities: ["low"] }))(task({})),
        ).toBe(false);
        expect(createTaskFilter(filters({ columns: ["c1"] }))(task({}))).toBe(
            true,
        );
    });

    it("uses inclusive calendar-date bounds and excludes undated tasks", () => {
        const f = createTaskFilter(
            filters({ dueDateFrom: "2026-03-01", dueDateTo: "2026-03-31" }),
        );
        expect(f(task({ due_date: "2026-03-01" }))).toBe(true);
        expect(f(task({ due_date: "2026-03-31T00:00:00.000000Z" }))).toBe(true);
        expect(f(task({ due_date: "2026-04-01" }))).toBe(false);
        expect(f(task({ due_date: undefined }))).toBe(false);
    });
});

describe("columnCountSummary", () => {
    it("shows a plain total when unfiltered", () => {
        expect(
            columnCountSummary({
                name: "Backlog",
                visible: 6,
                total: 6,
                filtered: false,
            }),
        ).toEqual({
            countText: "6",
            wipText: null,
            wipStatus: null,
            ariaLabel: "Backlog column, 6 tasks",
        });
    });

    it("shows visible of total while filtered", () => {
        const summary = columnCountSummary({
            name: "Backlog",
            visible: 1,
            total: 6,
            filtered: true,
        });
        expect(summary.countText).toBe("1 of 6");
        expect(summary.ariaLabel).toBe("Backlog column, showing 1 of 6 tasks");
    });

    it("lets the WIP pill carry the total and flags the limit", () => {
        const atLimit = columnCountSummary({
            name: "Doing",
            visible: 5,
            total: 5,
            wipLimit: 5,
            filtered: false,
        });
        expect(atLimit.countText).toBeNull();
        expect(atLimit.wipText).toBe("5/5 WIP");
        expect(atLimit.wipStatus).toBe("at");
        expect(atLimit.ariaLabel).toBe(
            "Doing column, 5 tasks, WIP limit 5, at limit",
        );

        const filteredOver = columnCountSummary({
            name: "Doing",
            visible: 1,
            total: 6,
            wipLimit: 5,
            filtered: true,
        });
        expect(filteredOver.countText).toBe("1 of 6");
        expect(filteredOver.wipStatus).toBe("over");
        expect(filteredOver.ariaLabel).toBe(
            "Doing column, showing 1 of 6 tasks, WIP limit 5, over limit",
        );
    });

    it("uses the singular for one task", () => {
        expect(
            columnCountSummary({
                name: "Done",
                visible: 1,
                total: 1,
                filtered: false,
            }).ariaLabel,
        ).toBe("Done column, 1 task");
    });
});

describe("listFooterText", () => {
    it("describes filtered and complete lists", () => {
        expect(listFooterText(3, 17)).toBe("Showing 3 of 17 tasks");
        expect(listFooterText(17, 17)).toBe("Showing all 17 tasks");
        expect(listFooterText(1, 1)).toBe("Showing 1 task");
        expect(listFooterText(0, 0)).toBe("No tasks on this board yet");
    });
});

describe("stored board view", () => {
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

    beforeEach(() => {
        vi.stubGlobal("localStorage", memoryStorage());
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("remembers the last view per board", () => {
        expect(getStoredBoardView("b1")).toBeNull();
        storeBoardView("b1", "workload");
        expect(getStoredBoardView("b1")).toBe("workload");
        expect(getStoredBoardView("b2")).toBeNull();
    });

    it("survives unavailable storage", () => {
        vi.stubGlobal("localStorage", {
            getItem: () => {
                throw new Error("blocked");
            },
            setItem: () => {
                throw new Error("blocked");
            },
        });
        expect(() => storeBoardView("b1", "list")).not.toThrow();
        expect(getStoredBoardView("b1")).toBeNull();
    });
});
