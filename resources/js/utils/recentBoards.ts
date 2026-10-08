/**
 * Recently visited boards, kept per browser in localStorage. This is a
 * per-viewer convenience only: reads fall back to an empty list whenever
 * storage is unavailable (private windows, blocked site data).
 */
const RECENT_BOARDS_KEY = "pulseboard-recent-boards";
const MAX_RECENT_BOARDS = 8;

export function getRecentBoardIds(): string[] {
    try {
        const raw = localStorage.getItem(RECENT_BOARDS_KEY);
        const parsed: unknown = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed)
            ? parsed.filter((id): id is string => typeof id === "string")
            : [];
    } catch {
        return [];
    }
}

/** Move a board to the front of the recent list. */
export function pushRecentBoard(boardId: string): string[] {
    const next = [
        boardId,
        ...getRecentBoardIds().filter((id) => id !== boardId),
    ].slice(0, MAX_RECENT_BOARDS);
    try {
        localStorage.setItem(RECENT_BOARDS_KEY, JSON.stringify(next));
    } catch {
        // Storage unavailable — recents simply won't persist.
    }
    return next;
}
