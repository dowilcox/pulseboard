interface Identified {
    id: string;
}

/**
 * Merge a freshly fetched first page into an already-loaded list: fresh
 * items come first (replacing stale copies), followed by the older items
 * that weren't in it. Keeps "Load more" pages when a new notification
 * arrives and the first page is refetched.
 */
export function mergeFirstPage<T extends Identified>(
    firstPage: T[],
    existing: T[],
): T[] {
    const fresh = new Set(firstPage.map((item) => item.id));
    return [...firstPage, ...existing.filter((item) => !fresh.has(item.id))];
}

/**
 * Append a later page, skipping items already shown. Offset pages shift
 * when new notifications arrive, so a later page can repeat items.
 */
export function appendPage<T extends Identified>(
    existing: T[],
    page: T[],
): T[] {
    const seen = new Set(existing.map((item) => item.id));
    return [...existing, ...page.filter((item) => !seen.has(item.id))];
}
