import RouterLink from "@/Components/Common/RouterLink";
import { useId, useRef, useState } from "react";
import Alert from "@mui/material/Alert";
import Badge from "@mui/material/Badge";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemButton from "@mui/material/ListItemButton";
import Popover from "@mui/material/Popover";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import DoneIcon from "@mui/icons-material/Done";
import NotificationsIcon from "@mui/icons-material/Notifications";
import ConfirmDialog from "@/Components/Common/ConfirmDialog";
import { useSnackbar } from "@/Contexts/SnackbarContext";
import { harbor } from "@/theme/harbor";
import { useNotifications } from "@/hooks/useNotifications";
import { formatTimestamp } from "@/utils/formatTimestamp";
import type { AppNotification } from "@/types";

const VISUALLY_HIDDEN = {
    position: "absolute",
    width: "1px",
    height: "1px",
    p: 0,
    m: -1,
    overflow: "hidden",
    clip: "rect(0 0 0 0)",
    whiteSpace: "nowrap",
    border: 0,
} as const;

function contextLabel(notification: AppNotification): string | null {
    const context = notification.context;
    if (!context) return null;
    return [context.team_name, context.board_name].filter(Boolean).join(" › ");
}

export default function NotificationBell() {
    const {
        unreadCount,
        notifications,
        fetchNotifications,
        loadMore,
        hasMore,
        loadingMore,
        markRead,
        markAllRead,
        clearAll,
        loaded,
        error,
    } = useNotifications();
    const { showSnackbar } = useSnackbar();
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const [confirmClearOpen, setConfirmClearOpen] = useState(false);
    const popoverId = useId();
    const headingId = useId();
    const open = Boolean(anchorEl);

    const handleOpen = (event: React.MouseEvent<HTMLElement>) => {
        setAnchorEl(event.currentTarget);
        if (!loaded) {
            fetchNotifications();
        }
    };

    const handleClose = () => {
        setAnchorEl(null);
    };

    const handleMarkRead = async (id: string) => {
        if (!(await markRead(id))) {
            showSnackbar("Couldn’t mark the notification as read.");
        }
    };

    const handleItemClick = (
        event: React.MouseEvent,
        notification: AppNotification,
    ) => {
        if (!notification.read_at) {
            void handleMarkRead(notification.id);
        }
        // Modified clicks open a new tab; keep the panel open for those.
        if (!event.metaKey && !event.ctrlKey && !event.shiftKey) {
            handleClose();
        }
    };

    const handleMarkAllRead = async () => {
        if (!(await markAllRead())) {
            showSnackbar("Couldn’t mark notifications as read.");
        }
    };

    const handleClearAll = async () => {
        setConfirmClearOpen(false);
        if (await clearAll()) {
            showSnackbar("Notifications cleared.", "success");
        } else {
            showSnackbar("Couldn’t clear notifications.");
        }
    };

    return (
        <>
            <IconButton
                size="small"
                onClick={handleOpen}
                aria-label={`Notifications (${unreadCount} unread)`}
                aria-haspopup="dialog"
                aria-expanded={open}
                aria-controls={open ? popoverId : undefined}
            >
                {/* Harbor: small red pill badge over a sub-toned bell */}
                <Badge
                    badgeContent={unreadCount}
                    max={99}
                    sx={{
                        "& .MuiBadge-badge": {
                            bgcolor: harbor.dueSoon.fg,
                            color: "#ffffff",
                            fontSize: "11px",
                            fontWeight: 700,
                            lineHeight: 1,
                            minWidth: 18,
                            height: 18,
                            px: "4px",
                        },
                    }}
                >
                    <NotificationsIcon sx={{ color: harbor.sub }} />
                </Badge>
            </IconButton>

            <Popover
                id={popoverId}
                open={open}
                anchorEl={anchorEl}
                onClose={handleClose}
                anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
                transformOrigin={{ vertical: "top", horizontal: "right" }}
                slotProps={{
                    paper: {
                        elevation: 3,
                        role: "dialog",
                        "aria-labelledby": headingId,
                        sx: {
                            width: { xs: "calc(100vw - 32px)", sm: 400 },
                            maxWidth: 400,
                            maxHeight: "min(560px, calc(100vh - 96px))",
                            mt: 1,
                            display: "flex",
                            flexDirection: "column",
                        },
                    },
                }}
            >
                <Box
                    sx={{
                        px: 2,
                        py: 1,
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: 1,
                        flexShrink: 0,
                    }}
                >
                    <Typography
                        id={headingId}
                        variant="subtitle2"
                        component="h2"
                        fontWeight={600}
                    >
                        Notifications
                    </Typography>
                    <Box sx={{ display: "flex", gap: 0.5 }}>
                        {unreadCount > 0 && (
                            <Button
                                size="small"
                                onClick={handleMarkAllRead}
                                sx={{
                                    textTransform: "none",
                                    fontSize: "0.75rem",
                                }}
                            >
                                Mark all read
                            </Button>
                        )}
                        {notifications.length > 0 && (
                            <Button
                                size="small"
                                color="error"
                                onClick={() => setConfirmClearOpen(true)}
                                sx={{
                                    textTransform: "none",
                                    fontSize: "0.75rem",
                                }}
                            >
                                Clear all
                            </Button>
                        )}
                    </Box>
                </Box>
                <Divider />

                <Box sx={{ overflowY: "auto", flex: "1 1 auto" }}>
                    {error === "fetch" && (
                        <Alert
                            severity="error"
                            sx={{ m: 1.5 }}
                            action={
                                <Button
                                    color="inherit"
                                    size="small"
                                    onClick={() => fetchNotifications()}
                                >
                                    Retry
                                </Button>
                            }
                        >
                            Couldn’t load notifications.
                        </Alert>
                    )}

                    {notifications.length === 0 && error !== "fetch" && (
                        <Typography
                            variant="body2"
                            color="text.secondary"
                            sx={{ px: 2, py: 3, textAlign: "center" }}
                            aria-live="polite"
                        >
                            {loaded ? "You’re all caught up." : "Loading…"}
                        </Typography>
                    )}

                    {notifications.length > 0 && (
                        <List disablePadding aria-labelledby={headingId}>
                            {notifications.map((notification) => (
                                <NotificationRow
                                    key={notification.id}
                                    notification={notification}
                                    onItemClick={handleItemClick}
                                    onMarkRead={handleMarkRead}
                                />
                            ))}
                        </List>
                    )}

                    {hasMore && (
                        <Box sx={{ p: 1, textAlign: "center" }}>
                            <Button
                                size="small"
                                onClick={() => void loadMore()}
                                disabled={loadingMore}
                            >
                                {loadingMore ? "Loading…" : "Load more"}
                            </Button>
                            {error === "load_more" && (
                                <Typography
                                    variant="caption"
                                    color="error"
                                    sx={{ display: "block" }}
                                    role="alert"
                                >
                                    Couldn’t load more notifications.
                                </Typography>
                            )}
                        </Box>
                    )}
                </Box>
            </Popover>

            <ConfirmDialog
                open={confirmClearOpen}
                onClose={() => setConfirmClearOpen(false)}
                onConfirm={handleClearAll}
                title="Clear all notifications?"
                message="This permanently deletes every notification, including unread ones. To just dismiss them, use “Mark all read” instead."
                confirmLabel="Clear all"
                confirmColor="error"
            />
        </>
    );
}

interface NotificationRowProps {
    notification: AppNotification;
    onItemClick: (event: React.MouseEvent, n: AppNotification) => void;
    onMarkRead: (id: string) => Promise<void>;
}

function NotificationRow({
    notification,
    onItemClick,
    onMarkRead,
}: NotificationRowProps) {
    const messageId = useId();
    const itemRef = useRef<HTMLElement>(null);
    const unread = !notification.read_at;

    // The button disappears once read, so hand focus to the row itself.
    const handleMarkRead = async () => {
        await onMarkRead(notification.id);
        itemRef.current?.focus();
    };
    const context = contextLabel(notification);
    const created = new Date(notification.created_at);

    const content = (
        <Box sx={{ display: "flex", gap: 1.25, width: "100%", minWidth: 0 }}>
            <Box
                aria-hidden
                sx={{
                    width: 8,
                    height: 8,
                    mt: 0.75,
                    borderRadius: "50%",
                    flexShrink: 0,
                    bgcolor: unread ? "primary.main" : "transparent",
                }}
            />
            <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography
                    id={messageId}
                    variant="body2"
                    sx={{
                        lineHeight: 1.4,
                        fontWeight: unread ? 600 : 400,
                        overflowWrap: "anywhere",
                    }}
                >
                    {unread && (
                        <Box component="span" sx={VISUALLY_HIDDEN}>
                            Unread:{" "}
                        </Box>
                    )}
                    {notification.data.message}
                </Typography>
                <Typography
                    variant="caption"
                    sx={{ color: harbor.sub, display: "block" }}
                >
                    {context && <>{context} · </>}
                    <time
                        dateTime={notification.created_at}
                        title={created.toLocaleString()}
                    >
                        {formatTimestamp(notification.created_at)}
                    </time>
                </Typography>
            </Box>
        </Box>
    );

    return (
        <ListItem
            disablePadding
            divider
            sx={{
                bgcolor: unread ? "action.hover" : "transparent",
                // Leave room for the mark-read button.
                "& .MuiListItemButton-root, & > .notification-static": {
                    pr: unread ? 6 : 2,
                },
            }}
            secondaryAction={
                unread ? (
                    <Tooltip title="Mark as read">
                        <IconButton
                            edge="end"
                            size="small"
                            aria-label="Mark as read"
                            aria-describedby={messageId}
                            onClick={() => void handleMarkRead()}
                        >
                            <DoneIcon fontSize="small" />
                        </IconButton>
                    </Tooltip>
                ) : undefined
            }
        >
            {notification.url ? (
                <ListItemButton
                    component={RouterLink}
                    ref={itemRef as React.Ref<HTMLAnchorElement>}
                    href={notification.url}
                    onClick={(event: React.MouseEvent) =>
                        onItemClick(event, notification)
                    }
                    sx={{ py: 1.25, pl: 2, alignItems: "flex-start" }}
                >
                    {content}
                </ListItemButton>
            ) : (
                <Box
                    className="notification-static"
                    ref={itemRef}
                    tabIndex={-1}
                    sx={{ py: 1.25, pl: 2, width: "100%", outline: "none" }}
                >
                    {content}
                </Box>
            )}
        </ListItem>
    );
}
