import { describe, expect, it } from "vitest";
import type { Board, Team } from "@/types";
import {
    MATCH_SCORE,
    isApplePlatform,
    isEditableTarget,
    isTaskNumberQuery,
    matchName,
    normalizeQuery,
    rankByName,
    resolveBoardIds,
    searchBoards,
    searchTeams,
    shortcutHint,
    shouldSearchTasks,
} from "./quickSwitcher";

function board(id: string, name: string, teamId: string): Board {
    return {
        id,
        team_id: teamId,
        name,
        slug: name.toLowerCase().replace(/\s+/g, "-"),
        is_archived: false,
        sort_order: 0,
        created_at: "",
        updated_at: "",
    };
}

function team(id: string, name: string, boards: Board[]): Team {
    return {
        id,
        name,
        slug: name.toLowerCase(),
        settings: {},
        created_at: "",
        updated_at: "",
        boards,
    };
}

const teams: Team[] = [
    team("eng", "Engineering", [
        board("web", "Website", "eng"),
        board("api", "Public API", "eng"),
        board("ops", "Dev Ops", "eng"),
    ]),
    team("des", "Design", [
        board("brand", "Brand refresh", "des"),
        board("webdes", "Web design system", "des"),
    ]),
    team("mkt", "Marketing", []),
];

describe("normalizeQuery", () => {
    it("trims, lowercases and collapses whitespace", () => {
        expect(normalizeQuery("  Web   Design ")).toBe("web design");
    });
});

describe("matchName", () => {
    it("returns null for empty queries and non-matches", () => {
        expect(matchName("Website", "   ")).toBeNull();
        expect(matchName("Website", "xyz")).toBeNull();
    });

    it("is case-insensitive", () => {
        expect(matchName("Website", "WEB")?.score).toBe(MATCH_SCORE.prefix);
    });

    it("ranks exact, prefix, word-start and substring matches in order", () => {
        expect(matchName("Web", "web")?.score).toBe(MATCH_SCORE.exact);
        expect(matchName("Website", "web")?.score).toBe(MATCH_SCORE.prefix);
        expect(matchName("Public API", "api")?.score).toBe(
            MATCH_SCORE.wordStart,
        );
        expect(matchName("Engineering", "gin")?.score).toBe(
            MATCH_SCORE.substring,
        );
    });

    it("reports the highlighted range, preferring a word start", () => {
        expect(matchName("Website", "site")?.range).toEqual([3, 7]);
        // "de" first appears inside "Code" but also starts the word "deploy".
        expect(matchName("Code deploy", "de")).toEqual({
            score: MATCH_SCORE.wordStart,
            range: [5, 7],
        });
    });

    it("treats punctuation as a word boundary", () => {
        expect(matchName("Q4-roadmap", "road")?.score).toBe(
            MATCH_SCORE.wordStart,
        );
    });

    it("matches multi-word queries against the context as a last resort", () => {
        expect(matchName("Website", "eng web", "Engineering")).toEqual({
            score: MATCH_SCORE.words,
            range: null,
        });
        expect(matchName("Website", "design web", "Engineering")).toBeNull();
    });
});

describe("rankByName", () => {
    it("sorts by score then alphabetically", () => {
        const names = ["Webhooks", "Old web", "Web", "Cobweb", "Alpha web"];
        const ranked = rankByName(names, "web", (n) => n).map((r) => r.item);
        expect(ranked).toEqual([
            "Web",
            "Webhooks",
            "Alpha web",
            "Old web",
            "Cobweb",
        ]);
    });

    it("applies the limit after ranking", () => {
        const ranked = rankByName(
            ["xweb", "web"],
            "web",
            (n) => n,
            undefined,
            1,
        );
        expect(ranked.map((r) => r.item)).toEqual(["web"]);
    });
});

describe("searchBoards", () => {
    it("finds boards across teams with their team", () => {
        const results = searchBoards(teams, "web");
        expect(results.map((r) => [r.item.board.id, r.item.team.name])).toEqual(
            [
                ["webdes", "Design"],
                ["web", "Engineering"],
            ],
        );
    });

    it("ranks word-start matches above substrings", () => {
        const results = searchBoards(teams, "ops");
        expect(results[0].item.board.id).toBe("ops");
    });

    it("can narrow by team name with a multi-word query", () => {
        const results = searchBoards(teams, "design web");
        // Both words appear in "Design" + "Web design system"; the
        // Engineering "Website" board lacks "design", so it is excluded.
        expect(results.map((r) => r.item.board.id)).toEqual(["webdes"]);
    });

    it("respects the limit", () => {
        expect(searchBoards(teams, "e", 2)).toHaveLength(2);
    });
});

describe("searchTeams", () => {
    it("filters teams by name", () => {
        expect(searchTeams(teams, "des").map((r) => r.item.id)).toEqual([
            "des",
        ]);
        expect(searchTeams(teams, "ing").map((r) => r.item.id)).toEqual([
            "eng",
            "mkt",
        ]);
    });
});

describe("resolveBoardIds", () => {
    it("keeps the given order and drops unknown ids and duplicates", () => {
        const entries = resolveBoardIds(teams, [
            "brand",
            "missing",
            "web",
            "brand",
        ]);
        expect(entries.map((e) => [e.board.id, e.team.id])).toEqual([
            ["brand", "des"],
            ["web", "eng"],
        ]);
    });

    it("skips excluded ids", () => {
        const entries = resolveBoardIds(
            teams,
            ["web", "api"],
            new Set(["web"]),
        );
        expect(entries.map((e) => e.board.id)).toEqual(["api"]);
    });
});

describe("task search predicates", () => {
    it("recognises task numbers with or without #", () => {
        expect(isTaskNumberQuery("12")).toBe(true);
        expect(isTaskNumberQuery(" #7 ")).toBe(true);
        expect(isTaskNumberQuery("#")).toBe(false);
        expect(isTaskNumberQuery("12a")).toBe(false);
    });

    it("searches tasks for 2+ characters or a task number", () => {
        expect(shouldSearchTasks("")).toBe(false);
        expect(shouldSearchTasks("a")).toBe(false);
        expect(shouldSearchTasks(" a ")).toBe(false);
        expect(shouldSearchTasks("ab")).toBe(true);
        expect(shouldSearchTasks("7")).toBe(true);
        expect(shouldSearchTasks("#")).toBe(false);
    });

    it("skips queries the server would reject as too long", () => {
        expect(shouldSearchTasks("a".repeat(100))).toBe(true);
        expect(shouldSearchTasks("a".repeat(101))).toBe(false);
    });
});

describe("isEditableTarget", () => {
    it("detects form fields and contenteditable regions", () => {
        const input = document.createElement("input");
        const textarea = document.createElement("textarea");
        const select = document.createElement("select");
        const editor = document.createElement("div");
        editor.setAttribute("contenteditable", "true");
        const paragraph = document.createElement("p");
        editor.appendChild(paragraph);

        for (const el of [input, textarea, select, editor, paragraph]) {
            expect(isEditableTarget(el)).toBe(true);
        }
    });

    it("ignores ordinary elements and non-elements", () => {
        const button = document.createElement("button");
        const readonly = document.createElement("div");
        readonly.setAttribute("contenteditable", "false");

        expect(isEditableTarget(button)).toBe(false);
        expect(isEditableTarget(readonly)).toBe(false);
        expect(isEditableTarget(document.body)).toBe(false);
        expect(isEditableTarget(null)).toBe(false);
        expect(isEditableTarget(window)).toBe(false);
    });
});

describe("platform shortcut hint", () => {
    it("uses ⌘ on Apple platforms and Ctrl elsewhere", () => {
        expect(isApplePlatform({ platform: "MacIntel", userAgent: "" })).toBe(
            true,
        );
        expect(isApplePlatform({ platform: "", userAgent: "iPhone" })).toBe(
            true,
        );
        expect(isApplePlatform({ platform: "Win32", userAgent: "" })).toBe(
            false,
        );
        expect(shortcutHint(true)).toBe("⌘K");
        expect(shortcutHint(false)).toBe("Ctrl K");
    });
});
