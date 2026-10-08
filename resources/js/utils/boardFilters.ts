import type { BoardViewMode, SavedFilter, Task } from "@/types";

/**
 * Board view + filter state, and its URL serialization.
 *
 * The URL is the source of truth for what the board shows, so Back from a
 * task, reloads and shared links all restore the exact view:
 *
 *   ?view=list&saved=<id>&q=login&assignees=<id>,<id>&labels=<id>
 *    &priority=high,urgent&columns=<id>&due_from=2026-03-01&due_to=2026-03-31
 *
 * `filter=none` records that the user cleared filters, so the board's default
 * saved filter is not re-applied when they come back to this history entry.
 */

export interface BoardFilters {
    search: string;
    assignees: string[];
    labels: string[];
    priorities: string[];
    /** Column ids ("Status" in the UI). */
    columns: string[];
    /** Inclusive calendar-date bounds, "YYYY-MM-DD" or "". */
    dueDateFrom: string;
    dueDateTo: string;
}

export const EMPTY_FILTERS: BoardFilters = Object.freeze({
    search: "",
    assignees: [],
    labels: [],
    priorities: [],
    columns: [],
    dueDateFrom: "",
    dueDateTo: "",
}) as BoardFilters;

export interface BoardState {
    view: BoardViewMode;
    filters: BoardFilters;
    /** The saved filter currently applied, while the filters still match it. */
    savedFilterId: string | null;
    /** The user explicitly cleared filters (`filter=none`). */
    cleared: boolean;
}

export interface ParsedBoardSearch {
    view: BoardViewMode | null;
    filters: BoardFilters;
    savedFilterId: string | null;
    cleared: boolean;
    /** Any of q/assignees/labels/priority/columns/due_* was present. */
    hasFilterParams: boolean;
}

export const PRIORITY_VALUES = [
    "urgent",
    "high",
    "medium",
    "low",
    "none",
] as const;

const VIEW_PARAM: Record<BoardViewMode, string> = {
    kanban: "board",
    list: "list",
    workload: "workload",
};

const PARAM_VIEW: Record<string, BoardViewMode> = {
    board: "kanban",
    kanban: "kanban",
    list: "list",
    workload: "workload",
};

const FILTER_PARAMS = [
    "q",
    "assignees",
    "labels",
    "priority",
    "columns",
    "due_from",
    "due_to",
] as const;

const OWN_PARAMS = new Set<string>([
    "view",
    "saved",
    "filter",
    ...FILTER_PARAMS,
]);

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

function uniqueList(values: Iterable<string>): string[] {
    const out: string[] = [];
    for (const raw of values) {
        const value = raw.trim();
        if (value && !out.includes(value)) out.push(value);
    }
    return out;
}

function parseList(value: string | null): string[] {
    if (!value) return [];
    return uniqueList(value.split(","));
}

function parseDate(value: string | null | undefined): string {
    return value && DATE_ONLY.test(value) ? value : "";
}

function parsePriorities(values: string[]): string[] {
    return values.filter((p) =>
        (PRIORITY_VALUES as readonly string[]).includes(p),
    );
}

export function parseBoardView(value: string | null): BoardViewMode | null {
    if (!value) return null;
    return PARAM_VIEW[value.toLowerCase()] ?? null;
}

/** Parse a `location.search` string ("?a=b" or "a=b"). */
export function parseBoardSearch(search: string): ParsedBoardSearch {
    const params = new URLSearchParams(search);

    const filters: BoardFilters = {
        search: (params.get("q") ?? "").trim(),
        assignees: parseList(params.get("assignees")),
        labels: parseList(params.get("labels")),
        priorities: parsePriorities(parseList(params.get("priority"))),
        columns: parseList(params.get("columns")),
        dueDateFrom: parseDate(params.get("due_from")),
        dueDateTo: parseDate(params.get("due_to")),
    };

    return {
        view: parseBoardView(params.get("view")),
        filters,
        savedFilterId: params.get("saved") || null,
        cleared: params.get("filter") === "none",
        hasFilterParams: hasActiveFilters(filters),
    };
}

function encodeList(values: string[]): string {
    return values.map(encodeURIComponent).join(",");
}

/**
 * Build the `location.search` for a board state, keeping any unrelated query
 * parameters already in `currentSearch`. Returns "" when there is nothing to
 * encode, otherwise a string starting with "?". Commas in lists stay literal
 * so URLs remain readable.
 */
export function buildBoardSearch(
    currentSearch: string,
    state: BoardState,
): string {
    const parts: string[] = [];
    const add = (key: string, value: string) => {
        if (value) parts.push(`${key}=${value}`);
    };

    add("view", VIEW_PARAM[state.view]);

    const { filters } = state;
    const active = hasActiveFilters(filters);
    if (active && state.savedFilterId) {
        add("saved", encodeURIComponent(state.savedFilterId));
    }
    add("q", encodeURIComponent(filters.search.trim()));
    add("assignees", encodeList(filters.assignees));
    add("labels", encodeList(filters.labels));
    add("priority", encodeList(filters.priorities));
    add("columns", encodeList(filters.columns));
    add("due_from", filters.dueDateFrom);
    add("due_to", filters.dueDateTo);
    if (!active && state.cleared) add("filter", "none");

    const existing = new URLSearchParams(currentSearch);
    for (const [key, value] of existing) {
        if (!OWN_PARAMS.has(key)) {
            parts.push(
                `${encodeURIComponent(key)}=${encodeURIComponent(value)}`,
            );
        }
    }

    return parts.length > 0 ? `?${parts.join("&")}` : "";
}

export function hasActiveFilters(filters: BoardFilters): boolean {
    return (
        filters.search.trim() !== "" ||
        filters.assignees.length > 0 ||
        filters.labels.length > 0 ||
        filters.priorities.length > 0 ||
        filters.columns.length > 0 ||
        filters.dueDateFrom !== "" ||
        filters.dueDateTo !== ""
    );
}

/**
 * Number of selections hidden behind the "Filters" popover (labels,
 * priority, status and due date), for its badge.
 */
export function countPopoverFilters(filters: BoardFilters): number {
    return (
        filters.labels.length +
        filters.priorities.length +
        filters.columns.length +
        (filters.dueDateFrom || filters.dueDateTo ? 1 : 0)
    );
}

function sameSet(a: string[], b: string[]): boolean {
    if (a.length !== b.length) return false;
    const set = new Set(a);
    return b.every((value) => set.has(value));
}

export function filtersEqual(a: BoardFilters, b: BoardFilters): boolean {
    return (
        a.search.trim() === b.search.trim() &&
        sameSet(a.assignees, b.assignees) &&
        sameSet(a.labels, b.labels) &&
        sameSet(a.priorities, b.priorities) &&
        sameSet(a.columns, b.columns) &&
        a.dueDateFrom === b.dueDateFrom &&
        a.dueDateTo === b.dueDateTo
    );
}

function stringList(value: unknown): string[] {
    if (typeof value === "string") return uniqueList([value]);
    if (!Array.isArray(value)) return [];
    return uniqueList(value.filter((v): v is string => typeof v === "string"));
}

/** Read a saved filter's `filter_config`, tolerating missing/legacy keys. */
export function normalizeFilterConfig(config: unknown): BoardFilters {
    const c =
        config && typeof config === "object"
            ? (config as Record<string, unknown>)
            : {};
    return {
        search: typeof c.search === "string" ? c.search.trim() : "",
        assignees: stringList(c.assignees ?? c.assignee),
        labels: stringList(c.labels ?? c.label),
        priorities: parsePriorities(stringList(c.priorities ?? c.priority)),
        columns: stringList(c.columns ?? c.column),
        dueDateFrom: parseDate(c.dueDateFrom as string | undefined),
        dueDateTo: parseDate(c.dueDateTo as string | undefined),
    };
}

/** The `filter_config` payload stored for a saved filter (non-empty keys only). */
export function filtersToConfig(
    filters: BoardFilters,
): Partial<Record<keyof BoardFilters, string | string[]>> {
    const config: Partial<Record<keyof BoardFilters, string | string[]>> = {};
    if (filters.search.trim()) config.search = filters.search.trim();
    if (filters.assignees.length) config.assignees = filters.assignees;
    if (filters.labels.length) config.labels = filters.labels;
    if (filters.priorities.length) config.priorities = filters.priorities;
    if (filters.columns.length) config.columns = filters.columns;
    if (filters.dueDateFrom) config.dueDateFrom = filters.dueDateFrom;
    if (filters.dueDateTo) config.dueDateTo = filters.dueDateTo;
    return config;
}

/**
 * Work out the board state on page load.
 *
 * - `?view` wins; otherwise the last view used on this board; else Kanban.
 * - Explicit filter params win (and `saved` names the filter only while the
 *   params still match it).
 * - `saved` alone applies that saved filter.
 * - `filter=none` keeps the board unfiltered.
 * - Otherwise this is a fresh entry: apply the default saved filter, if any.
 *
 * `syncUrl` is true when the URL should be rewritten to reflect the state
 * (e.g. the default filter was applied), so Back restores it exactly.
 */
export function resolveBoardState(
    search: string,
    savedFilters: Pick<SavedFilter, "id" | "filter_config" | "is_default">[],
    storedView: BoardViewMode | null,
): { state: BoardState; syncUrl: boolean } {
    const parsed = parseBoardSearch(search);
    const view = parsed.view ?? storedView ?? "kanban";
    const saved = parsed.savedFilterId
        ? savedFilters.find((f) => f.id === parsed.savedFilterId)
        : undefined;

    if (parsed.hasFilterParams) {
        const matchesSaved =
            saved !== undefined &&
            filtersEqual(
                parsed.filters,
                normalizeFilterConfig(saved.filter_config),
            );
        return {
            state: {
                view,
                filters: parsed.filters,
                savedFilterId: matchesSaved ? saved.id : null,
                cleared: false,
            },
            syncUrl: Boolean(parsed.savedFilterId) && !matchesSaved,
        };
    }

    if (saved) {
        const filters = normalizeFilterConfig(saved.filter_config);
        return {
            state: {
                view,
                filters,
                savedFilterId: hasActiveFilters(filters) ? saved.id : null,
                cleared: false,
            },
            syncUrl: true,
        };
    }

    if (parsed.cleared) {
        return {
            state: {
                view,
                filters: EMPTY_FILTERS,
                savedFilterId: null,
                cleared: true,
            },
            syncUrl: false,
        };
    }

    const defaultFilter = savedFilters.find((f) => f.is_default);
    if (defaultFilter) {
        const filters = normalizeFilterConfig(defaultFilter.filter_config);
        if (hasActiveFilters(filters)) {
            return {
                state: {
                    view,
                    filters,
                    savedFilterId: defaultFilter.id,
                    cleared: false,
                },
                syncUrl: true,
            };
        }
    }

    return {
        state: {
            view,
            filters: EMPTY_FILTERS,
            savedFilterId: null,
            cleared: false,
        },
        syncUrl: parsed.savedFilterId !== null,
    };
}

/**
 * Apply a user edit to the filters: the saved-filter name stays only while
 * the filters still match that saved filter, and emptying the filters is
 * recorded so a default filter doesn't come back on Back.
 */
export function withFilters(
    state: BoardState,
    filters: BoardFilters,
    savedFilters: Pick<SavedFilter, "id" | "filter_config" | "is_default">[],
): BoardState {
    const saved = state.savedFilterId
        ? savedFilters.find((f) => f.id === state.savedFilterId)
        : undefined;
    const stillSaved =
        saved !== undefined &&
        filtersEqual(filters, normalizeFilterConfig(saved.filter_config));
    return {
        ...state,
        filters,
        savedFilterId: stillSaved ? saved.id : null,
        cleared: !hasActiveFilters(filters),
    };
}

/** Predicate for the board's client-side task filtering. */
export function createTaskFilter(
    filters: BoardFilters,
): (task: Task) => boolean {
    if (!hasActiveFilters(filters)) return () => true;

    const search = filters.search.trim().toLowerCase();
    const numberQuery = /^#?(\d+)$/.exec(search)?.[1];
    const assignees = new Set(filters.assignees);
    const labels = new Set(filters.labels);
    const priorities = new Set(filters.priorities);
    const columns = new Set(filters.columns);

    return (task: Task) => {
        if (search) {
            const titleMatch = task.title.toLowerCase().includes(search);
            const numberMatch =
                numberQuery !== undefined &&
                String(task.task_number ?? "") === numberQuery;
            if (!titleMatch && !numberMatch) return false;
        }
        if (
            assignees.size > 0 &&
            !(task.assignees ?? []).some((a) => assignees.has(a.id))
        ) {
            return false;
        }
        if (
            labels.size > 0 &&
            !(task.labels ?? []).some((l) => labels.has(l.id))
        ) {
            return false;
        }
        if (priorities.size > 0 && !priorities.has(task.priority)) {
            return false;
        }
        if (columns.size > 0 && !columns.has(task.column_id)) {
            return false;
        }
        if (filters.dueDateFrom || filters.dueDateTo) {
            const due = task.due_date?.slice(0, 10);
            if (!due) return false;
            if (filters.dueDateFrom && due < filters.dueDateFrom) return false;
            if (filters.dueDateTo && due > filters.dueDateTo) return false;
        }
        return true;
    };
}

// ── Counts ────────────────────────────────────────────────────────────

export function pluralize(
    count: number,
    singular: string,
    plural = `${singular}s`,
): string {
    return `${count} ${count === 1 ? singular : plural}`;
}

export type WipStatus = "under" | "at" | "over";

export interface ColumnCountSummary {
    /** Count pill text: "6", or "1 of 6" while filtered; null when the WIP pill carries the total. */
    countText: string | null;
    /** WIP pill text, e.g. "5/5 WIP"; null without a WIP limit. */
    wipText: string | null;
    wipStatus: WipStatus | null;
    /** Full description for the column region. */
    ariaLabel: string;
}

export function columnCountSummary({
    name,
    visible,
    total,
    wipLimit,
    filtered,
}: {
    name: string;
    visible: number;
    total: number;
    wipLimit?: number | null;
    filtered: boolean;
}): ColumnCountSummary {
    const hasWip = wipLimit != null && wipLimit > 0;
    const wipStatus: WipStatus | null = hasWip
        ? total > wipLimit
            ? "over"
            : total === wipLimit
              ? "at"
              : "under"
        : null;

    const countText = filtered
        ? `${visible} of ${total}`
        : hasWip
          ? null
          : String(total);

    let ariaLabel = filtered
        ? `${name} column, showing ${visible} of ${pluralize(total, "task")}`
        : `${name} column, ${pluralize(total, "task")}`;
    if (hasWip) {
        ariaLabel += `, WIP limit ${wipLimit}`;
        if (wipStatus === "at") ariaLabel += ", at limit";
        if (wipStatus === "over") ariaLabel += ", over limit";
    }

    return {
        countText,
        wipText: hasWip ? `${total}/${wipLimit} WIP` : null,
        wipStatus,
        ariaLabel,
    };
}

/** List view footer: "Showing 3 of 17 tasks" / "Showing all 17 tasks". */
export function listFooterText(shown: number, total: number): string {
    if (total === 0) return "No tasks on this board yet";
    if (shown >= total) {
        return total === 1 ? "Showing 1 task" : `Showing all ${total} tasks`;
    }
    return `Showing ${shown} of ${pluralize(total, "task")}`;
}

// ── Per-board view memory ─────────────────────────────────────────────

function viewStorageKey(boardId: string): string {
    return `pulseboard:board-view:${boardId}`;
}

export function getStoredBoardView(boardId: string): BoardViewMode | null {
    try {
        return parseBoardView(localStorage.getItem(viewStorageKey(boardId)));
    } catch {
        return null;
    }
}

export function storeBoardView(boardId: string, view: BoardViewMode): void {
    try {
        localStorage.setItem(viewStorageKey(boardId), VIEW_PARAM[view]);
    } catch {
        // Storage unavailable (private mode, blocked) — the URL still works.
    }
}
