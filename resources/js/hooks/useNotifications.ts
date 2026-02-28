import { useEffect, useState, useCallback } from 'react';
import { usePage } from '@inertiajs/react';
import { useWebSocket } from '@/Contexts/WebSocketContext';
import type { AppNotification, PageProps } from '@/types';

interface NotificationEvent {
    id: string;
    type: string;
    message: string;
}

export function useNotifications() {
    const { auth, unreadNotificationsCount } = usePage<PageProps>().props;
    const { echo } = useWebSocket();
    const [unreadCount, setUnreadCount] = useState(unreadNotificationsCount ?? 0);
    const [notifications, setNotifications] = useState<AppNotification[]>([]);
    const [loaded, setLoaded] = useState(false);

    // Sync count from server props
    useEffect(() => {
        setUnreadCount(unreadNotificationsCount ?? 0);
    }, [unreadNotificationsCount]);

    // Listen for real-time notification events
    useEffect(() => {
        if (!auth.user) return;

        const channel = echo.private(`user.${auth.user.id}`);

        channel.listen('.notification.created', (_event: NotificationEvent) => {
            setUnreadCount((prev) => prev + 1);
            // Refresh notifications list if already loaded
            if (loaded) {
                fetchNotifications();
            }
        });

        return () => {
            echo.leave(`user.${auth.user.id}`);
        };
    }, [auth.user?.id, echo, loaded]);

    const fetchNotifications = useCallback(async () => {
        try {
            const res = await fetch(route('notifications.index'), {
                headers: { Accept: 'application/json' },
            });
            const data = await res.json();
            setNotifications(data.data ?? []);
            setLoaded(true);
        } catch {
            // silently fail
        }
    }, []);

    const markRead = useCallback(async (id: string) => {
        try {
            await fetch(route('notifications.read', id), {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                    'X-CSRF-TOKEN': document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content ?? '',
                },
            });
            setNotifications((prev) =>
                prev.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n))
            );
            setUnreadCount((prev) => Math.max(0, prev - 1));
        } catch {
            // silently fail
        }
    }, []);

    const markAllRead = useCallback(async () => {
        try {
            await fetch(route('notifications.read-all'), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                    'X-CSRF-TOKEN': document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content ?? '',
                },
            });
            setNotifications((prev) =>
                prev.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() }))
            );
            setUnreadCount(0);
        } catch {
            // silently fail
        }
    }, []);

    return { unreadCount, notifications, fetchNotifications, markRead, markAllRead, loaded };
}
