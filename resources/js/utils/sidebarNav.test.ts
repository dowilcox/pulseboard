import { describe, expect, it } from "vitest";
import type { Board, Team } from "@/types";
import {
    applySavedOrder,
    buildBoardIndex,
    isTeamExpanded,
    nameInitials,
    parseExpandedTeams,
    resolveRecentBoards,
    resolveStarredBoards,
    toggleStarredBoard,
} from "./sidebarNav";

function board(id: string, teamId: string): Board {
    return {
        id,
        team_id: teamId,
        name: `Board ${id}`,
        slug: id,
        is_archived: false,
        sort_order: 0,
        created_at: "",
        updated_at: "",
    };
}

function team(id: string, boardIds: string[]): Team {
    return {
        id,
        name: `Team ${id}`,
        slug: id,
        settings: {},
        created_at: "",
        updated_at: "",
        boards: boardIds.map((boardId) => board(boardId, id)),
    };
}

const teams = [team("eng", ["a", "b", "c"]), team("design", ["d", "e"])];
const index = buildBoardIndex(teams);

describe("nameInitials", () => {
    it("takes the first letter of up to two words", () => {
        expect(nameInitials("Sprint 2")).toBe("S2");
        expect(nameInitials("  pulse   board  tasks ")).toBe("PB");
        expect(nameInitials("Engineering")).toBe("E");
    });

    it("falls back for blank names", () => {
        expect(nameInitials("   ")).toBe("?");
    });
});

describe("applySavedOrder", () => {
    const items = [{ id: "a" }, { id: "b" }, { id: "c" }];

    it("returns the original order without a saved order", () => {
        expect(applySavedOrder(items)).toBe(items);
        expect(applySavedOrder(items, [])).toBe(items);
    });

    it("orders by saved IDs, appends new items, ignores stale IDs", () => {
        expect(
            applySavedOrder(items, ["c", "gone", "a"]).map((i) => i.id),
        ).toEqual(["c", "a", "b"]);
    });
});

describe("buildBoardIndex", () => {
    it("maps each board to its team", () => {
        expect(index.get("d")?.team.id).toBe("design");
        expect(index.get("a")?.board.id).toBe("a");
        expect(index.size).toBe(5);
    });
});

describe("resolveStarredBoards", () => {
    it("keeps starred order and skips unknown or duplicate IDs", () => {
        const refs = resolveStarredBoards(["e", "missing", "a", "e"], index);
        expect(refs.map((r) => r.board.id)).toEqual(["e", "a"]);
    });
});

describe("resolveRecentBoards", () => {
    it("skips starred and unknown boards and caps the list", () => {
        const refs = resolveRecentBoards(
            ["a", "zzz", "b", "c", "d", "e"],
            ["b"],
            index,
            3,
        );
        expect(refs.map((r) => r.board.id)).toEqual(["a", "c", "d"]);
    });

    it("defaults to five entries", () => {
        expect(
            resolveRecentBoards(["a", "b", "c", "d", "e"], [], index),
        ).toHaveLength(5);
        expect(
            resolveRecentBoards(["a", "b", "c", "d", "e", "a"], [], index),
        ).toHaveLength(5);
    });
});

describe("toggleStarredBoard", () => {
    it("appends a new star and removes an existing one", () => {
        expect(toggleStarredBoard(["a"], "b")).toEqual(["a", "b"]);
        expect(toggleStarredBoard(["a", "b"], "a")).toEqual(["b"]);
    });

    it("never exceeds the server limit", () => {
        const many = Array.from({ length: 100 }, (_, i) => `id-${i}`);
        const next = toggleStarredBoard(many, "new");
        expect(next).toHaveLength(100);
        expect(next[next.length - 1]).toBe("new");
    });
});

describe("parseExpandedTeams", () => {
    it("reads booleans and drops everything else", () => {
        expect(
            parseExpandedTeams('{"eng":true,"design":false,"x":"yes"}'),
        ).toEqual({ eng: true, design: false });
    });

    it("tolerates missing or corrupt values", () => {
        expect(parseExpandedTeams(null)).toEqual({});
        expect(parseExpandedTeams("{nope")).toEqual({});
        expect(parseExpandedTeams("[true]")).toEqual({});
    });
});

describe("isTeamExpanded", () => {
    it("expands every team by default when the user has only a few", () => {
        expect(isTeamExpanded("eng", {}, undefined, 1)).toBe(true);
        expect(isTeamExpanded("design", {}, "eng", 3)).toBe(true);
        expect(isTeamExpanded("design", {}, undefined, 5)).toBe(true);
    });

    it("with many teams, expands only the current team by default", () => {
        expect(isTeamExpanded("eng", {}, "eng", 8)).toBe(true);
        expect(isTeamExpanded("design", {}, "eng", 8)).toBe(false);
        expect(isTeamExpanded("design", {}, undefined, 8)).toBe(false);
    });

    it("respects an explicit choice", () => {
        expect(isTeamExpanded("eng", { eng: false }, "eng", 3)).toBe(false);
        expect(isTeamExpanded("design", { design: true }, "eng", 3)).toBe(true);
    });
});
