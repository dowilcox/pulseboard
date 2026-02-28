import Chip from '@mui/material/Chip';
import WifiOffIcon from '@mui/icons-material/WifiOff';
import SyncIcon from '@mui/icons-material/Sync';
import { useWebSocket } from '@/Contexts/WebSocketContext';

export default function ConnectionStatus() {
    const { connectionStatus } = useWebSocket();

    if (connectionStatus === 'connected') {
        return null;
    }

    if (connectionStatus === 'connecting') {
        return (
            <Chip
                icon={<SyncIcon sx={{ animation: 'spin 1s linear infinite', '@keyframes spin': { from: { transform: 'rotate(0deg)' }, to: { transform: 'rotate(360deg)' } } }} />}
                label="Reconnecting..."
                color="warning"
                size="small"
                variant="outlined"
                sx={{ mr: 1 }}
            />
        );
    }

    return (
        <Chip
            icon={<WifiOffIcon />}
            label="Disconnected"
            color="error"
            size="small"
            variant="outlined"
            sx={{ mr: 1 }}
        />
    );
}
