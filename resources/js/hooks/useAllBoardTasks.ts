import axios from "axios";
import { useEffect, useRef, useState } from "react";
import { useSnackbar } from "@/Contexts/SnackbarContext";
import type { Task } from "@/types";

interface AllTasksResponse {
    data: Task[];
    total: number;
    limit: number;
    truncated: boolean;
}

export interface AllBoardTasks {
    tasks: Task[];
    /** Tasks on the board (may exceed tasks.length when truncated). */
    total: number;
    truncated: boolean;
    /** The `reloadKey` this snapshot was fetched for. */
    key: unknown;
}

interface Options {
    teamSlug: string;
    boardSlug: string;
    /** Fetch only while a view needs every task. */
    enabled: boolean;
    /**
     * Changes whenever the board data changes (pass the Inertia `board`
     * prop): a new key triggers a refetch so the snapshot never lags behind
     * real-time updates.
     */
    reloadKey: unknown;
}

/**
 * Load every task on a board (bounded server-side) via the "all" mode of
 * `boards.tasks.index`. List, Workload and filtered Kanban use it so that
 * sorting, filtering and counts cover the whole board rather than the first
 * page of each column.
 */
export function useAllBoardTasks({
    teamSlug,
    boardSlug,
    enabled,
    reloadKey,
}: Options) {
    const { showSnackbar } = useSnackbar();
    const [data, setData] = useState<AllBoardTasks | null>(null);
    const [loading, setLoading] = useState(false);
    const [failed, setFailed] = useState(false);
    // Key of the snapshot currently held, so re-enabling (e.g. switching back
    // to List) doesn't refetch data that is still current.
    const loadedKeyRef = useRef<unknown>(undefined);

    useEffect(() => {
        if (!enabled) {
            // A snapshot from older board data would be stale; drop it.
            if (loadedKeyRef.current !== reloadKey) {
                loadedKeyRef.current = undefined;
                setData(null);
            }
            setLoading(false);
            return;
        }

        if (loadedKeyRef.current === reloadKey) return;

        const controller = new AbortController();
        setLoading(true);

        axios
            .get<AllTasksResponse>(
                route("boards.tasks.index", [teamSlug, boardSlug]),
                { params: { all: 1 }, signal: controller.signal },
            )
            .then(({ data: response }) => {
                loadedKeyRef.current = reloadKey;
                setData({
                    tasks: response.data,
                    total: response.total,
                    truncated: response.truncated,
                    key: reloadKey,
                });
                setFailed(false);
                setLoading(false);
            })
            .catch((error) => {
                if (axios.isCancel(error)) return;
                setFailed(true);
                setLoading(false);
                showSnackbar(
                    "Couldn't load every task on this board. Counts may be incomplete.",
                    "error",
                );
            });

        return () => controller.abort();
    }, [enabled, reloadKey, teamSlug, boardSlug, showSnackbar]);

    return {
        data,
        loading,
        failed,
        /** True when `data` reflects the current `reloadKey`. */
        fresh: data !== null && data.key === reloadKey,
    };
}
