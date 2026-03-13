import type { PaginatedResponse, Task } from "@/types";
import { useCallback, useEffect, useRef, useState } from "react";

interface UseLoadMoreTasksOptions {
    teamId: string;
    boardId: string;
    perPage?: number;
}

interface ColumnLoadState {
    page: number;
    hasMore: boolean;
    loading: boolean;
}

/**
 * Hook for lazily loading more tasks for a board, either by column or globally.
 * Uses the boards.tasks.index route endpoint.
 */
export function useLoadMoreTasks({
    teamId,
    boardId,
    perPage = 50,
}: UseLoadMoreTasksOptions) {
    const [columnLoadStates, setColumnLoadStates] = useState<
        Record<string, ColumnLoadState>
    >({});
    const [globalLoadState, setGlobalLoadState] = useState<ColumnLoadState>({
        page: 1,
        hasMore: true,
        loading: false,
    });
    const abortControllers = useRef<Record<string, AbortController>>({});

    // Abort all in-flight requests on unmount
    useEffect(() => {
        return () => {
            for (const controller of Object.values(abortControllers.current)) {
                controller.abort();
            }
            abortControllers.current = {};
        };
    }, []);

    /**
     * Initialize load state for a column based on its initial task count vs total.
     */
    const initColumnState = useCallback(
        (columnId: string, loadedCount: number, totalCount: number) => {
            setColumnLoadStates((prev) => {
                if (prev[columnId]) return prev;
                return {
                    ...prev,
                    [columnId]: {
                        page: 1,
                        hasMore: loadedCount < totalCount,
                        loading: false,
                    },
                };
            });
        },
        [],
    );

    /**
     * Initialize global load state for list view based on total loaded vs total available.
     */
    const initGlobalState = useCallback(
        (loadedCount: number, totalCount: number) => {
            setGlobalLoadState({
                page: 1,
                hasMore: loadedCount < totalCount,
                loading: false,
            });
        },
        [],
    );

    /**
     * Fetch the next page of tasks for a specific column.
     * Returns the new tasks to be appended.
     */
    const loadMoreForColumn = useCallback(
        async (columnId: string): Promise<Task[]> => {
            const state = columnLoadStates[columnId];
            if (!state || !state.hasMore || state.loading) return [];

            // Abort any in-flight request for this column
            const key = `col-${columnId}`;
            abortControllers.current[key]?.abort();
            const controller = new AbortController();
            abortControllers.current[key] = controller;

            setColumnLoadStates((prev) => ({
                ...prev,
                [columnId]: { ...prev[columnId], loading: true },
            }));

            try {
                const nextPage = state.page + 1;
                const params = new URLSearchParams({
                    column_id: columnId,
                    page: String(nextPage),
                    per_page: String(perPage),
                    sort: "sort_order",
                    direction: "asc",
                });

                const response = await fetch(
                    `${route("boards.tasks.index", [teamId, boardId])}?${params}`,
                    {
                        headers: { Accept: "application/json" },
                        signal: controller.signal,
                    },
                );

                if (!response.ok) throw new Error("Failed to load tasks");

                const data: PaginatedResponse<Task> = await response.json();

                setColumnLoadStates((prev) => ({
                    ...prev,
                    [columnId]: {
                        page: nextPage,
                        hasMore: data.current_page < data.last_page,
                        loading: false,
                    },
                }));

                return data.data;
            } catch (error) {
                if (error instanceof Error && error.name === "AbortError")
                    return [];

                setColumnLoadStates((prev) => ({
                    ...prev,
                    [columnId]: { ...prev[columnId], loading: false },
                }));
                return [];
            }
        },
        [columnLoadStates, teamId, boardId, perPage],
    );

    /**
     * Fetch the next page of tasks globally (all columns, for list view).
     * Supports sorting.
     */
    const loadMoreGlobal = useCallback(
        async (sort = "sort_order", direction = "asc"): Promise<Task[]> => {
            if (!globalLoadState.hasMore || globalLoadState.loading) return [];

            const key = "global";
            abortControllers.current[key]?.abort();
            const controller = new AbortController();
            abortControllers.current[key] = controller;

            setGlobalLoadState((prev) => ({ ...prev, loading: true }));

            try {
                const nextPage = globalLoadState.page + 1;
                const params = new URLSearchParams({
                    page: String(nextPage),
                    per_page: String(perPage),
                    sort,
                    direction,
                });

                const response = await fetch(
                    `${route("boards.tasks.index", [teamId, boardId])}?${params}`,
                    {
                        headers: { Accept: "application/json" },
                        signal: controller.signal,
                    },
                );

                if (!response.ok) throw new Error("Failed to load tasks");

                const data: PaginatedResponse<Task> = await response.json();

                setGlobalLoadState({
                    page: nextPage,
                    hasMore: data.current_page < data.last_page,
                    loading: false,
                });

                return data.data;
            } catch (error) {
                if (error instanceof Error && error.name === "AbortError")
                    return [];

                setGlobalLoadState((prev) => ({ ...prev, loading: false }));
                return [];
            }
        },
        [globalLoadState, teamId, boardId, perPage],
    );

    const getColumnState = useCallback(
        (columnId: string): ColumnLoadState =>
            columnLoadStates[columnId] ?? {
                page: 1,
                hasMore: false,
                loading: false,
            },
        [columnLoadStates],
    );

    return {
        initColumnState,
        initGlobalState,
        loadMoreForColumn,
        loadMoreGlobal,
        getColumnState,
        globalLoadState,
    };
}
