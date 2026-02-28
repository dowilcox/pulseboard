import { useState } from 'react';
import { router } from '@inertiajs/react';
import Badge from '@mui/material/Badge';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Typography from '@mui/material/Typography';
import NotificationsIcon from '@mui/icons-material/Notifications';
import { useNotifications } from '@/hooks/useNotifications';

function timeAgo(dateString: string): string {
    const seconds = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000);
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
}

export default function NotificationBell() {
    const { unreadCount, notifications, fetchNotifications, markRead, markAllRead, loaded } =
        useNotifications();
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const menuOpen = Boolean(anchorEl);

    const handleOpen = (event: React.MouseEvent<HTMLElement>) => {
        setAnchorEl(event.currentTarget);
        if (!loaded) {
            fetchNotifications();
        }
    };

    const handleClose = () => {
        setAnchorEl(null);
    };

    const handleClickNotification = (notification: (typeof notifications)[0]) => {
        if (!notification.read_at) {
            markRead(notification.id);
        }
        handleClose();

        // Navigate to the task if we have the data
        const data = notification.data;
        if (data.team_id && data.board_id && data.task_id) {
            router.get(route('teams.boards.show', [data.team_id, data.board_id]));
        }
    };

    return (
        <>
            <IconButton size="small" onClick={handleOpen}>
                <Badge badgeContent={unreadCount} color="error" max={99}>
                    <NotificationsIcon />
                </Badge>
            </IconButton>

            <Menu
                anchorEl={anchorEl}
                open={menuOpen}
                onClose={handleClose}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                slotProps={{
                    paper: {
                        elevation: 3,
                        sx: { minWidth: 320, maxWidth: 400, maxHeight: 480, mt: 1 },
                    },
                }}
            >
                <Box sx={{ px: 2, py: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="subtitle2" fontWeight={600}>
                        Notifications
                    </Typography>
                    {unreadCount > 0 && (
                        <Button
                            size="small"
                            onClick={() => markAllRead()}
                            sx={{ textTransform: 'none', fontSize: '0.75rem' }}
                        >
                            Mark all read
                        </Button>
                    )}
                </Box>
                <Divider />

                {notifications.length === 0 && (
                    <MenuItem disabled>
                        <Typography variant="body2" color="text.secondary">
                            {loaded ? 'No notifications' : 'Loading...'}
                        </Typography>
                    </MenuItem>
                )}

                {notifications.map((notification) => (
                    <MenuItem
                        key={notification.id}
                        onClick={() => handleClickNotification(notification)}
                        sx={{
                            whiteSpace: 'normal',
                            bgcolor: notification.read_at ? 'transparent' : 'action.hover',
                            py: 1.5,
                        }}
                    >
                        <Box sx={{ width: '100%' }}>
                            <Typography variant="body2" sx={{ lineHeight: 1.4 }}>
                                {notification.data.message}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                                {timeAgo(notification.created_at)}
                            </Typography>
                        </Box>
                    </MenuItem>
                ))}
            </Menu>
        </>
    );
}
