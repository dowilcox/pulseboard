import { useEffect, useState, useCallback, useRef } from "react";
import { usePage } from "@inertiajs/react";
import { useWebSocket } from "@/Contexts/WebSocketContext";
import type { AppNotification, PageProps } from "@/types";

type NotificationError = "fetch" | "mark_read" | "mark_all_read";

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
            const res = await fetch(route("notifications.index"), {
                headers: { Accept: "application/json" },
                signal: controller.signal,
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            setNotifications(data.data ?? []);
            setLoaded(true);
        } catch (err) {
            if (err instanceof Error && err.name === "AbortError") return;
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
            const res = await fetch(route("notifications.read", id), {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    "X-Requested-With": "XMLHttpRequest",
                    "X-CSRF-TOKEN":
                        document.querySelector<HTMLMetaElement>(
                            'meta[name="csrf-token"]',
                        )?.content ?? "",
                },
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
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
            const res = await fetch(route("notifications.read-all"), {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-Requested-With": "XMLHttpRequest",
                    "X-CSRF-TOKEN":
                        document.querySelector<HTMLMetaElement>(
                            'meta[name="csrf-token"]',
                        )?.content ?? "",
                },
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
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
            const res = await fetch(route("notifications.clear-all"), {
                method: "DELETE",
                headers: {
                    "Content-Type": "application/json",
                    "X-Requested-With": "XMLHttpRequest",
                    "X-CSRF-TOKEN":
                        document.querySelector<HTMLMetaElement>(
                            'meta[name="csrf-token"]',
                        )?.content ?? "",
                },
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            setNotifications([]);
            setUnreadCount(0);
        } catch {
            setError("mark_all_read");
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
