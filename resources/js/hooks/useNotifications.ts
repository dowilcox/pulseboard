import { useEffect, useState, useCallback, useRef } from "react";
import axios from "axios";
import { usePage } from "@inertiajs/react";
import { useWebSocket } from "@/Contexts/WebSocketContext";
import type { AppNotification, PageProps } from "@/types";

type NotificationError = "fetch" | "mark_read" | "mark_all_read" | "clear_all";

interface NotificationEvent {
    id: string;
    type: string;
    message: string;
}

export function useNotifications() {
    const { auth, unreadNotificationsCount } = usePage<PageProps>().props;
    const { echo } = useWebSocket();
    const [unreadCount, setUnreadCount] = useState(
        unreadNotificationsCount ?? 0,
    );
    const [notifications, setNotifications] = useState<AppNotification[]>([]);
    const [loaded, setLoaded] = useState(false);
    const [error, setError] = useState<NotificationError | null>(null);
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

    const fetchNotifications = useCallback(async () => {
        fetchControllerRef.current?.abort();
        const controller = new AbortController();
        fetchControllerRef.current = controller;
        try {
            setError(null);
            const { data } = await axios.get(route("notifications.index"), {
                signal: controller.signal,
            });
            setNotifications(data.data ?? []);
            setLoaded(true);
        } catch (err) {
            if (axios.isCancel(err)) return;
            setError("fetch");
        }
    }, []);

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

    const markRead = useCallback(async (id: string) => {
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
        } catch {
            setError("mark_read");
        }
    }, []);

    const markAllRead = useCallback(async () => {
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
        } catch {
            setError("mark_all_read");
        }
    }, []);

    const clearAll = useCallback(async () => {
        try {
            setError(null);
            await axios.delete(route("notifications.clear-all"));
            setNotifications([]);
            setUnreadCount(0);
        } catch {
            setError("clear_all");
        }
    }, []);

    return {
        unreadCount,
        notifications,
        fetchNotifications,
        markRead,
        markAllRead,
        clearAll,
        loaded,
        error,
    };
}
