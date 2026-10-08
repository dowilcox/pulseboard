import { useEffect, useState, useCallback, useRef } from "react";
import axios from "axios";
import { usePage } from "@inertiajs/react";
import { useWebSocket } from "@/Contexts/WebSocketContext";
import { appendPage, mergeFirstPage } from "@/utils/notificationList";
import type {
    AppNotification,
    NotificationIndexResponse,
    PageProps,
} from "@/types";

type NotificationError =
    | "fetch"
    | "load_more"
    | "mark_read"
    | "mark_all_read"
    | "clear_all";

interface NotificationEvent {
    id: string;
    type: string;
    message: string;
}

export function useNotifications() {
    const { auth, unreadNotificationsCount } = usePage<PageProps>().props;
    const { echo, reconnectVersion } = useWebSocket();
    const [unreadCount, setUnreadCount] = useState(
        unreadNotificationsCount ?? 0,
    );
    const [notifications, setNotifications] = useState<AppNotification[]>([]);
    const [loaded, setLoaded] = useState(false);
    const [error, setError] = useState<NotificationError | null>(null);
    /** Pages fetched so far; "Load more" asks for the next one. */
    const [pagesLoaded, setPagesLoaded] = useState(0);
    const [lastPage, setLastPage] = useState(1);
    const [loadingMore, setLoadingMore] = useState(false);
    const fetchControllerRef = useRef<AbortController | null>(null);

    // Abort pending fetches on unmount
    useEffect(() => {
        return () => {
            fetchControllerRef.current?.abort();
        };
    }, []);

    // Sync count from server props
    useEffect(() => {
        setUnreadCount(unreadNotificationsCount ?? 0);
    }, [unreadNotificationsCount]);

    /** Fetch (or refresh) the first page, keeping any later pages loaded. */
    const fetchNotifications = useCallback(async () => {
        fetchControllerRef.current?.abort();
        const controller = new AbortController();
        fetchControllerRef.current = controller;
        try {
            setError(null);
            const { data } = await axios.get<NotificationIndexResponse>(
                route("notifications.index"),
                {
                    signal: controller.signal,
                },
            );
            setNotifications((prev) => mergeFirstPage(data.data ?? [], prev));
            setUnreadCount(data.unread_count ?? 0);
            setLastPage(data.last_page ?? 1);
            setPagesLoaded((prev) => Math.max(prev, 1));
            setLoaded(true);
        } catch (err) {
            if (axios.isCancel(err)) return;
            setError("fetch");
        }
    }, []);

    const loadMore = useCallback(async () => {
        if (loadingMore) return;
        setLoadingMore(true);
        try {
            setError(null);
            const { data } = await axios.get<NotificationIndexResponse>(
                route("notifications.index"),
                { params: { page: pagesLoaded + 1 } },
            );
            setNotifications((prev) => appendPage(prev, data.data ?? []));
            setUnreadCount(data.unread_count ?? 0);
            setLastPage(data.last_page ?? 1);
            setPagesLoaded(data.current_page ?? pagesLoaded + 1);
        } catch {
            setError("load_more");
        } finally {
            setLoadingMore(false);
        }
    }, [loadingMore, pagesLoaded]);

    // Track loaded state in a ref to avoid re-subscribing the channel
    const loadedRef = useRef(loaded);
    loadedRef.current = loaded;

    // Listen for real-time notification events
    useEffect(() => {
        if (!auth.user || !echo) return;

        const channel = echo.private(`user.${auth.user.id}`);

        channel.listen(".notification.created", (_event: NotificationEvent) => {
            setUnreadCount((prev) => prev + 1);
            // Refresh notifications list if already loaded
            if (loadedRef.current) {
                fetchNotifications();
            }
        });

        return () => {
            echo.leave(`user.${auth.user.id}`);
        };
    }, [auth.user?.id, echo, fetchNotifications]);

    useEffect(() => {
        if (!auth.user || reconnectVersion === 0) return;

        fetchNotifications();
    }, [auth.user?.id, reconnectVersion, fetchNotifications]);

    /** Mark one notification read. Resolves false when the request fails. */
    const markRead = useCallback(async (id: string): Promise<boolean> => {
        try {
            setError(null);
            await axios.patch(route("notifications.read", id));
            setNotifications((prev) =>
                prev.map((n) =>
                    n.id === id
                        ? { ...n, read_at: new Date().toISOString() }
                        : n,
                ),
            );
            setUnreadCount((prev) => Math.max(0, prev - 1));
            return true;
        } catch {
            setError("mark_read");
            return false;
        }
    }, []);

    const markAllRead = useCallback(async (): Promise<boolean> => {
        try {
            setError(null);
            await axios.post(route("notifications.read-all"));
            setNotifications((prev) =>
                prev.map((n) => ({
                    ...n,
                    read_at: n.read_at ?? new Date().toISOString(),
                })),
            );
            setUnreadCount(0);
            return true;
        } catch {
            setError("mark_all_read");
            return false;
        }
    }, []);

    const clearAll = useCallback(async (): Promise<boolean> => {
        try {
            setError(null);
            await axios.delete(route("notifications.clear-all"));
            setNotifications([]);
            setUnreadCount(0);
            setPagesLoaded(1);
            setLastPage(1);
            return true;
        } catch {
            setError("clear_all");
            return false;
        }
    }, []);

    return {
        unreadCount,
        notifications,
        fetchNotifications,
        loadMore,
        hasMore: loaded && pagesLoaded < lastPage,
        loadingMore,
        markRead,
        markAllRead,
        clearAll,
        loaded,
        error,
    };
}
