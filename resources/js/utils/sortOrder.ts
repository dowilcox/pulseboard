/**
 * Compute a new sort_order for inserting at a given index.
 *
 * @param sortOrders - The current sort_order values in the list (already sorted ascending).
 * @param targetIndex - The index at which to insert (0 = before first, length = after last).
 */
export function computeSortOrder(sortOrders: number[], targetIndex: number): number {
    if (sortOrders.length === 0) {
        return 1;
    }

    if (targetIndex <= 0) {
        // Insert before the first item
        return sortOrders[0] - 1;
    }

    if (targetIndex >= sortOrders.length) {
        // Insert after the last item
        return sortOrders[sortOrders.length - 1] + 1;
    }

    // Insert between two items
    const before = sortOrders[targetIndex - 1];
    const after = sortOrders[targetIndex];
    return (before + after) / 2;
}
