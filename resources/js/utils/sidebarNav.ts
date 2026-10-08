/**
 * Pure helpers behind the team-grouped sidebar: board ordering, the
 * Starred/Recent sections, star toggling, and per-team expansion state.
 */
import type { Board, Team } from "@/types";

export interface BoardRef {
    board: Board;
    team: Team;
}

export const MAX_RECENT_SIDEBAR_BOARDS = 5;
export const MAX_STARRED_BOARDS = 100;

/** Up to `max` uppercase initials from the leading words of a name. */
export function nameInitials(name: string, max = 2): string {
    const initials = name
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, max)
        .map((word) => word.charAt(0))
        .join("")
        .toUpperCase();
    return initials || "?";
}

/**
 * Sort items by a saved ID order. Items missing from the order (e.g. newly
 * created boards) keep their original relative order and go last; IDs in
 * the order that no longer exist are ignored.
 */
export function applySavedOrder<T extends { id: string }>(
    items: T[],
    order?: string[] | null,
): T[] {
    if (!order || order.length === 0) return items;
    const byId = new Map(items.map((item) => [item.id, item]));
    const ordered: T[] = [];
    for (const id of order) {
        const item = byId.get(id);
        if (item) {
            ordered.push(item);
            byId.delete(id);
        }
    }
    for (const item of byId.values()) {
        ordered.push(item);
    }
    return ordered;
}

/** Map every board in the given teams to itself plus its team. */
export function buildBoardIndex(teams: Team[]): Map<string, BoardRef> {
    const index = new Map<string, BoardRef>();
    for (const team of teams) {
        for (const board of team.boards ?? []) {
            index.set(board.id, { board, team });
        }
    }
    return index;
}

/** Starred boards in starred order, skipping IDs the user can't see. */
export function resolveStarredBoards(
    starredIds: string[],
    index: Map<string, BoardRef>,
): BoardRef[] {
    const seen = new Set<string>();
    const refs: BoardRef[] = [];
    for (const id of starredIds) {
        const ref = index.get(id);
        if (ref && !seen.has(id)) {
            seen.add(id);
            refs.push(ref);
        }
    }
    return refs;
}

/**
 * Most recent boards first, excluding starred boards (already listed above)
 * and IDs that are unknown (deleted, archived, or from a team the user left).
 */
export function resolveRecentBoards(
    recentIds: string[],
    starredIds: string[],
    index: Map<string, BoardRef>,
    limit = MAX_RECENT_SIDEBAR_BOARDS,
): BoardRef[] {
    const skip = new Set(starredIds);
    const refs: BoardRef[] = [];
    for (const id of recentIds) {
        if (refs.length >= limit) break;
        const ref = index.get(id);
        if (ref && !skip.has(id)) {
            skip.add(id);
            refs.push(ref);
        }
    }
    return refs;
}

/** Star (append) or unstar (remove) a board; keeps the list unique. */
export function toggleStarredBoard(starredIds: string[], boardId: string) {
    if (starredIds.includes(boardId)) {
        return starredIds.filter((id) => id !== boardId);
    }
    return [...starredIds, boardId].slice(-MAX_STARRED_BOARDS);
}

/** Parse the persisted `{ [teamId]: expanded }` map, tolerating junk. */
export function parseExpandedTeams(
    raw: string | null,
): Record<string, boolean> {
    if (!raw) return {};
    try {
        const parsed: unknown = JSON.parse(raw);
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
            return {};
        }
        const result: Record<string, boolean> = {};
        for (const [key, value] of Object.entries(parsed)) {
            if (typeof value === "boolean") result[key] = value;
        }
        return result;
    } catch {
        return {};
    }
}

/**
 * Up to this many teams, every team starts expanded so all boards are one
 * click away from any page (including the Dashboard, which has no team).
 */
export const AUTO_EXPAND_MAX_TEAMS = 5;

/**
 * Explicit user choice wins. Otherwise the team of the current page starts
 * expanded, and so does every team when the user has only a few; with more
 * teams the rest start collapsed to keep the sidebar scannable.
 */
export function isTeamExpanded(
    teamId: string,
    expandedTeams: Record<string, boolean>,
    currentTeamId: string | undefined,
    teamCount: number,
): boolean {
    const explicit = expandedTeams[teamId];
    if (explicit !== undefined) return explicit;
    return teamId === currentTeamId || teamCount <= AUTO_EXPAND_MAX_TEAMS;
}
