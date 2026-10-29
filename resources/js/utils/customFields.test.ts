import { describe, expect, it } from "vitest";
import type { BoardCustomField, CustomFieldType, Task } from "@/types";
import {
    EMPTY_FILTERS,
    buildBoardSearch,
    countPopoverFilters,
    createTaskFilter,
    filtersEqual,
    filtersToConfig,
    hasActiveFilters,
    normalizeFilterConfig,
    parseBoardSearch,
} from "./boardFilters";
import {
    CF_HAS_VALUE,
    CF_NO_VALUE,
    compareSortValues,
    describeCardFields,
    describeFieldFilter,
    formatFieldValue,
    hasValue,
    matchesFieldFilter,
    selectedOptions,
    shortUrl,
    sortValue,
    toSaveValue,
} from "./customFields";

function field(
    type: CustomFieldType,
    overrides: Partial<BoardCustomField> = {},
): BoardCustomField {
    return {
        id: `f-${type}`,
        board_id: "b",
        name: type,
        type,
        options:
            type === "select" || type === "multi_select"
                ? [
                      { id: "lo", label: "Low", color: "#22c55e" },
                      { id: "hi", label: "High", color: "#ef4444" },
                  ]
                : null,
        sort_order: 0,
        show_on_card: false,
        created_at: "",
        updated_at: "",
        ...overrides,
    };
}

const task = (custom_fields: Record<string, unknown> | null) =>
    ({ custom_fields }) as Pick<Task, "custom_fields">;

describe("hasValue", () => {
    it("treats empty strings, empty lists, false and null as no value", () => {
        expect(hasValue(null)).toBe(false);
        expect(hasValue(undefined)).toBe(false);
        expect(hasValue("")).toBe(false);
        expect(hasValue([])).toBe(false);
        expect(hasValue(false)).toBe(false);
        expect(hasValue(0)).toBe(true);
        expect(hasValue("x")).toBe(true);
        expect(hasValue(["a"])).toBe(true);
        expect(hasValue(true)).toBe(true);
    });
});

describe("formatFieldValue", () => {
    it("formats each type", () => {
        expect(formatFieldValue(field("text"), "Acme")).toBe("Acme");
        expect(formatFieldValue(field("number"), 1234.5)).toBe(
            (1234.5).toLocaleString(),
        );
        expect(formatFieldValue(field("date"), "2026-11-02")).toContain("2026");
        expect(formatFieldValue(field("checkbox"), true)).toBe("Yes");
        expect(
            formatFieldValue(field("url"), "https://example.com/specs/42"),
        ).toBe("example.com/specs/42");
        expect(formatFieldValue(field("select"), "hi")).toBe("High");
        expect(formatFieldValue(field("multi_select"), ["hi", "lo"])).toBe(
            "Low, High",
        );
    });

    it("returns an empty string for missing values and unknown options", () => {
        expect(formatFieldValue(field("text"), null)).toBe("");
        expect(formatFieldValue(field("checkbox"), false)).toBe("");
        expect(formatFieldValue(field("select"), "gone")).toBe("");
    });
});

describe("selectedOptions", () => {
    it("keeps the field's option order and ignores unknown ids", () => {
        expect(
            selectedOptions(field("multi_select"), ["hi", "x", "lo"]).map(
                (o) => o.id,
            ),
        ).toEqual(["lo", "hi"]);
        expect(selectedOptions(field("select"), 42)).toEqual([]);
    });
});

describe("shortUrl", () => {
    it("drops the scheme and a bare root path", () => {
        expect(shortUrl("https://example.com/")).toBe("example.com");
        expect(shortUrl("not a url")).toBe("not a url");
    });
});

describe("describeCardFields", () => {
    it("summarises non-empty card fields", () => {
        const fields = [
            field("text", { id: "a", name: "Customer", show_on_card: true }),
            field("select", { id: "b", name: "Severity", show_on_card: true }),
            field("text", { id: "c", name: "Hidden" }),
            field("number", { id: "d", name: "Empty", show_on_card: true }),
        ];
        expect(
            describeCardFields(fields, task({ a: "Acme", b: "hi", c: "x" })),
        ).toBe("Customer: Acme, Severity: High");
        expect(describeCardFields(fields, task(null))).toBe("");
    });
});

describe("sortValue", () => {
    it("sorts options by position and empties as null", () => {
        expect(sortValue(field("select"), "hi")).toBe(1);
        expect(sortValue(field("multi_select"), ["hi"])).toBe(1);
        expect(sortValue(field("number"), 3)).toBe(3);
        expect(sortValue(field("text"), "Zed")).toBe("zed");
        expect(sortValue(field("text"), "")).toBeNull();
        expect(sortValue(field("checkbox"), true)).toBe(1);
    });

    it("compares numbers numerically and strings by locale", () => {
        expect(compareSortValues(2, 10)).toBeLessThan(0);
        expect(compareSortValues("b", "a")).toBeGreaterThan(0);
    });
});

describe("matchesFieldFilter", () => {
    it("matches option ids in single and multi values", () => {
        expect(matchesFieldFilter("hi", ["hi"])).toBe(true);
        expect(matchesFieldFilter("lo", ["hi"])).toBe(false);
        expect(matchesFieldFilter(["lo", "hi"], ["hi"])).toBe(true);
        expect(matchesFieldFilter(["lo"], ["hi", "lo"])).toBe(true);
    });

    it("supports has-value and empty tokens", () => {
        expect(matchesFieldFilter("x", [CF_HAS_VALUE])).toBe(true);
        expect(matchesFieldFilter(undefined, [CF_HAS_VALUE])).toBe(false);
        expect(matchesFieldFilter(undefined, [CF_NO_VALUE])).toBe(true);
        expect(matchesFieldFilter([], [CF_NO_VALUE])).toBe(true);
        expect(matchesFieldFilter(true, [CF_NO_VALUE])).toBe(false);
        expect(matchesFieldFilter(undefined, ["hi", CF_NO_VALUE])).toBe(true);
    });

    it("matches everything without tokens", () => {
        expect(matchesFieldFilter(undefined, [])).toBe(true);
    });
});

describe("describeFieldFilter", () => {
    it("names the field and choices", () => {
        expect(describeFieldFilter(field("select"), ["hi", CF_NO_VALUE])).toBe(
            "select: High, Empty",
        );
        expect(describeFieldFilter(field("checkbox"), [CF_HAS_VALUE])).toBe(
            "checkbox: Checked",
        );
        expect(describeFieldFilter(field("text"), [CF_HAS_VALUE])).toBe(
            "text: Has a value",
        );
        expect(describeFieldFilter(undefined, ["x"])).toBe("Deleted field");
    });
});

describe("toSaveValue", () => {
    it("normalizes inputs the way the server stores them", () => {
        expect(toSaveValue(field("text"), "  hi ")).toBe("hi");
        expect(toSaveValue(field("text"), "   ")).toBeNull();
        expect(toSaveValue(field("number"), "3.5")).toBe(3.5);
        expect(toSaveValue(field("number"), "")).toBeNull();
        expect(toSaveValue(field("number"), "abc")).toBe("abc");
        expect(toSaveValue(field("checkbox"), true)).toBe(true);
        expect(toSaveValue(field("checkbox"), false)).toBeNull();
        expect(toSaveValue(field("multi_select"), [])).toBeNull();
        expect(toSaveValue(field("select"), null)).toBeNull();
        expect(toSaveValue(field("date"), "2026-01-02")).toBe("2026-01-02");
    });
});

describe("board filters with custom fields", () => {
    const withCf = (customFields: Record<string, string[]>) => ({
        ...EMPTY_FILTERS,
        customFields,
    });

    it("round-trips through the URL", () => {
        const search = buildBoardSearch("?keep=1", {
            view: "list",
            filters: withCf({ sev: ["hi", CF_NO_VALUE], done: [CF_HAS_VALUE] }),
            savedFilterId: null,
            cleared: false,
        });
        expect(search).toBe(
            "?view=list&cf.done=__set&cf.sev=hi,__unset&keep=1",
        );
        const parsed = parseBoardSearch(search);
        expect(parsed.filters.customFields).toEqual({
            done: [CF_HAS_VALUE],
            sev: ["hi", CF_NO_VALUE],
        });
        expect(parsed.hasFilterParams).toBe(true);
    });

    it("replaces stale cf params instead of keeping them", () => {
        const search = buildBoardSearch("?cf.old=x", {
            view: "kanban",
            filters: EMPTY_FILTERS,
            savedFilterId: null,
            cleared: false,
        });
        expect(search).toBe("?view=board");
    });

    it("counts, compares and detects custom field filters", () => {
        expect(hasActiveFilters(withCf({}))).toBe(false);
        expect(hasActiveFilters(withCf({ a: [] }))).toBe(false);
        expect(hasActiveFilters(withCf({ a: ["x"] }))).toBe(true);
        expect(countPopoverFilters(withCf({ a: ["x", "y"], b: ["z"] }))).toBe(
            2,
        );
        expect(
            filtersEqual(withCf({ a: ["x", "y"] }), withCf({ a: ["y", "x"] })),
        ).toBe(true);
        expect(filtersEqual(withCf({ a: ["x"] }), withCf({ b: ["x"] }))).toBe(
            false,
        );
        expect(filtersEqual(withCf({}), EMPTY_FILTERS)).toBe(true);
    });

    it("persists in saved filter configs", () => {
        const config = filtersToConfig(withCf({ a: ["x"], b: [] }));
        expect(config.customFields).toEqual({ a: ["x"] });
        expect(normalizeFilterConfig(config).customFields).toEqual({
            a: ["x"],
        });
        expect(filtersToConfig(EMPTY_FILTERS).customFields).toBeUndefined();
        expect(
            normalizeFilterConfig({ customFields: { a: "x", b: 5 } })
                .customFields,
        ).toEqual({ a: ["x"] });
    });

    it("filters tasks: OR within a field, AND across fields", () => {
        const t = (custom_fields: Record<string, unknown> | null) =>
            ({
                id: "t",
                title: "Task",
                priority: "none",
                column_id: "c",
                custom_fields,
            }) as unknown as Task;
        const fn = createTaskFilter(
            withCf({ sev: ["hi", "lo"], done: [CF_HAS_VALUE] }),
        );
        expect(fn(t({ sev: "hi", done: true }))).toBe(true);
        expect(fn(t({ sev: "lo", done: true }))).toBe(true);
        expect(fn(t({ sev: "hi" }))).toBe(false);
        expect(fn(t(null))).toBe(false);
    });

    it("ignores filters on fields that no longer exist", () => {
        const t = { custom_fields: null, title: "x" } as unknown as Task;
        const filter = withCf({ gone: ["opt"] });
        expect(createTaskFilter(filter)(t)).toBe(false);
        expect(createTaskFilter(filter, ["other"])(t)).toBe(true);
    });
});
