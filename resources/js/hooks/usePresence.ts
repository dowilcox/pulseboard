import { useEffect, useState } from 'react';
import { useWebSocket } from '@/Contexts/WebSocketContext';

export interface PresenceUser {
    id: string;
    name: string;
    avatar_url: string | null;
}

export function usePresence(boardId: string) {
    const { echo } = useWebSocket();
    const [users, setUsers] = useState<PresenceUser[]>([]);

    useEffect(() => {
        const channel = echo.join(`presence-board.${boardId}`);

        channel
            .here((members: PresenceUser[]) => {
                setUsers(members);
            })
            .joining((member: PresenceUser) => {
                setUsers((prev) => {
                    if (prev.some((u) => u.id === member.id)) return prev;
                    return [...prev, member];
                });
            })
            .leaving((member: PresenceUser) => {
                setUsers((prev) => prev.filter((u) => u.id !== member.id));
            });

        return () => {
            echo.leave(`presence-board.${boardId}`);
        };
    }, [boardId, echo]);

    return users;
}
