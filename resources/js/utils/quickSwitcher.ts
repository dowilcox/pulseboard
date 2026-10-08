/**
 * Pure helpers for the global quick switcher (Cmd/Ctrl+K): client-side
 * matching and ranking of teams, boards and pages, plus the small predicates
 * that decide when to hit the server-side task search.
 */
import type { Board, Team } from "@/types";

/** Ranking tiers — lower is better. */
export const MATCH_SCORE = {
    exact: 0,
    prefix: 1,
    wordStart: 2,
    substring: 3,
    /** Every query word appears somewhere in the item's context text. */
    words: 4,
} as const;

export interface NameMatch {
    score: number;
    /** [start, end) of the matched text in the name, for highlighting. */
    range: [number, number] | null;
}

export interface Ranked<T> {
    item: T;
    match: NameMatch;
}

export interface BoardEntry {
    board: Board;
    team: Team;
}

/** Trim, lowercase and collapse runs of whitespace. */
export function normalizeQuery(query: string): string {
    return query.trim().toLowerCase().replace(/\s+/g, " ");
}

function isWordStart(text: string, index: number): boolean {
    if (index === 0) return true;
    return !/[\p{L}\p{N}]/u.test(text.charAt(index - 1));
}

/**
 * Match `name` against `query` (case-insensitive). Exact and prefix matches
 * rank first, then matches at the start of a word, then any substring. When
 * `context` is given (e.g. "Team Board"), a multi-word query whose words all
 * appear in it is a last-resort match.
 */
export function matchName(
    name: string,
    query: string,
    context?: string,
): NameMatch | null {
    const q = normalizeQuery(query);
    if (!q) return null;

    const text = name.toLowerCase();
    const first = text.indexOf(q);

    if (first !== -1) {
        const range: [number, number] = [first, first + q.length];
        if (text === q) return { score: MATCH_SCORE.exact, range };
        if (first === 0) return { score: MATCH_SCORE.prefix, range };

        for (let i = first; i !== -1; i = text.indexOf(q, i + 1)) {
            if (isWordStart(text, i)) {
                return {
                    score: MATCH_SCORE.wordStart,
                    range: [i, i + q.length],
                };
            }
        }

        return { score: MATCH_SCORE.substring, range };
    }

    const words = q.split(" ");
    if (words.length > 1) {
        const haystack = `${context ?? ""} ${text}`.toLowerCase();
        if (words.every((word) => haystack.includes(word))) {
            return { score: MATCH_SCORE.words, range: null };
        }
    }

    return null;
}

/**
 * Filter and rank items by name. Ties keep a stable alphabetical order so
 * results don't jump around while typing.
 */
export function rankByName<T>(
    items: readonly T[],
    query: string,
    getName: (item: T) => string,
    getContext?: (item: T) => string,
    limit = Infinity,
): Ranked<T>[] {
    const ranked: Ranked<T>[] = [];

    for (const item of items) {
        const match = matchName(getName(item), query, getContext?.(item));
        if (match) ranked.push({ item, match });
    }

    ranked.sort(
        (a, b) =>
            a.match.score - b.match.score ||
            getName(a.item).localeCompare(getName(b.item), undefined, {
                sensitivity: "base",
            }) ||
            (getContext?.(a.item) ?? "").localeCompare(
                getContext?.(b.item) ?? "",
            ),
    );

    return ranked.slice(0, limit);
}

/** Every board of every team, paired with its team. */
export function flattenBoards(teams: readonly Team[]): BoardEntry[] {
    return teams.flatMap((team) =>
        (team.boards ?? []).map((board) => ({ board, team })),
    );
}

export function searchBoards(
    teams: readonly Team[],
    query: string,
    limit = 8,
): Ranked<BoardEntry>[] {
    return rankByName(
        flattenBoards(teams),
        query,
        (entry) => entry.board.name,
        (entry) => entry.team.name,
        limit,
    );
}

export function searchTeams(
    teams: readonly Team[],
    query: string,
    limit = 5,
): Ranked<Team>[] {
    return rankByName(teams, query, (team) => team.name, undefined, limit);
}

/**
 * Resolve board ids (starred, recent) to boards the user can still see, in
 * the given order. Unknown ids (archived, deleted, team left) and duplicates
 * are dropped.
 */
export function resolveBoardIds(
    teams: readonly Team[],
    ids: readonly string[],
    exclude: ReadonlySet<string> = new Set(),
): BoardEntry[] {
    const byId = new Map(
        flattenBoards(teams).map((entry) => [entry.board.id, entry]),
    );
    const seen = new Set(exclude);
    const result: BoardEntry[] = [];

    for (const id of ids) {
        const entry = byId.get(id);
        if (!entry || seen.has(id)) continue;
        seen.add(id);
        result.push(entry);
    }

    return result;
}

/** "12" or "#12". */
export function isTaskNumberQuery(query: string): boolean {
    return /^#?\d+$/.test(query.trim());
}

/** Mirrors the server's validation (max 100) to avoid pointless requests. */
export const TASK_SEARCH_MAX_LENGTH = 100;

/** Task search runs for ≥2 characters, or for any task number. */
export function shouldSearchTasks(query: string): boolean {
    const q = query.trim();
    if (q.length > TASK_SEARCH_MAX_LENGTH) return false;
    return q.length >= 2 || isTaskNumberQuery(q);
}

/**
 * True when a keystroke targets something the user types into, so single-key
 * shortcuts like "/" must not fire. TipTap editors are contenteditable.
 */
export function isEditableTarget(target: EventTarget | null): boolean {
    if (!(target instanceof Element)) return false;

    const tag = target.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;

    return (
        (target instanceof HTMLElement && target.isContentEditable) ||
        target.closest('[contenteditable]:not([contenteditable="false"])') !==
            null
    );
}

/** Mac/iOS use ⌘ as the shortcut modifier; everything else uses Ctrl. */
export function isApplePlatform(
    nav:
        | Pick<Navigator, "platform" | "userAgent">
        | undefined = typeof navigator === "undefined" ? undefined : navigator,
): boolean {
    if (!nav) return false;
    const platform =
        (nav as Navigator & { userAgentData?: { platform?: string } })
            .userAgentData?.platform ||
        nav.platform ||
        nav.userAgent;
    return /mac|iphone|ipad|ipod/i.test(platform ?? "");
}

export function shortcutHint(apple: boolean): string {
    return apple ? "⌘K" : "Ctrl K";
}
