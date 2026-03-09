import { createContext, useContext, useEffect, useState, useMemo, type ReactNode } from 'react';
import { router } from '@inertiajs/react';
import echo from '@/echo';
import type Echo from 'laravel-echo';

type ConnectionStatus = 'connected' | 'connecting' | 'disconnected';

interface WebSocketContextValue {
    echo: Echo<'reverb'>;
    connectionStatus: ConnectionStatus;
}

const WebSocketContext = createContext<WebSocketContextValue>({
    echo: echo,
    connectionStatus: 'connecting',
});

export function useWebSocket() {
    return useContext(WebSocketContext);
}

export function WebSocketProvider({ children }: { children: ReactNode }) {
    const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting');

    useEffect(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- laravel-echo doesn't expose Pusher types on connector
        const connector = echo.connector as { pusher?: { connection: { bind: (event: string, cb: (...args: any[]) => void) => void; unbind: (event: string, cb: (...args: any[]) => void) => void; state: string } } };
        const pusher = connector?.pusher;

        if (!pusher) {
            return;
        }

        const handleConnected = () => setConnectionStatus('connected');
        const handleConnecting = () => setConnectionStatus('connecting');
        const handleDisconnected = () => setConnectionStatus('disconnected');

        pusher.connection.bind('connected', handleConnected);
        pusher.connection.bind('connecting', handleConnecting);
        pusher.connection.bind('unavailable', handleDisconnected);
        pusher.connection.bind('failed', handleDisconnected);
        pusher.connection.bind('disconnected', handleDisconnected);

        // If already connected
        if (pusher.connection.state === 'connected') {
            setConnectionStatus('connected');
        }

        // On reconnect, reload to catch up on missed events
        let wasDisconnected = false;
        const handleStateChange = ({ current, previous }: { current: string; previous: string }) => {
            if (previous === 'connected' && current !== 'connected') {
                wasDisconnected = true;
            }
            if (wasDisconnected && current === 'connected') {
                wasDisconnected = false;
                router.reload();
            }
        };
        pusher.connection.bind('state_change', handleStateChange);

        return () => {
            pusher.connection.unbind('connected', handleConnected);
            pusher.connection.unbind('connecting', handleConnecting);
            pusher.connection.unbind('unavailable', handleDisconnected);
            pusher.connection.unbind('failed', handleDisconnected);
            pusher.connection.unbind('disconnected', handleDisconnected);
            pusher.connection.unbind('state_change', handleStateChange);
        };
    }, []);

    const value = useMemo(() => ({ echo, connectionStatus }), [connectionStatus]);

    return (
        <WebSocketContext.Provider value={value}>
            {children}
        </WebSocketContext.Provider>
    );
}
