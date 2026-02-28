import { useEffect } from 'react';
import { useWebSocket } from '@/Contexts/WebSocketContext';

export interface BoardEvent {
    action: string;
    data: {
        task_id?: string;
        column_id?: string;
        sort_order?: number;
        comment_id?: string;
        changes?: Record<string, unknown>;
    };
    user_id: string;
}

export function useBoardChannel(boardId: string, onEvent: (event: BoardEvent) => void) {
    const { echo } = useWebSocket();

    useEffect(() => {
        const channel = echo.private(`board.${boardId}`);

        channel.listen('.board.changed', (event: BoardEvent) => {
            onEvent(event);
        });

        return () => {
            echo.leave(`board.${boardId}`);
        };
    }, [boardId, echo, onEvent]);
}
