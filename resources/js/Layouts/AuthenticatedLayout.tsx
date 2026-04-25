import { Link, usePage, router } from "@inertiajs/react";
import {
    type PropsWithChildren,
    type ReactNode,
    useEffect,
    useRef,
    useState,
} from "react";
import type { PageProps, Team } from "@/types";
import { SidebarProvider, useSidebar } from "@/Contexts/SidebarContext";
import { useThemeMode } from "@/Contexts/ThemeContext";
import Sidebar from "@/Components/Layout/Sidebar";
import AppBar from "@mui/material/AppBar";
import LinearProgress from "@mui/material/LinearProgress";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";
import Drawer from "@mui/material/Drawer";
import IconButton from "@mui/material/IconButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import LogoutIcon from "@mui/icons-material/Logout";
import MenuIcon from "@mui/icons-material/Menu";
import PersonIcon from "@mui/icons-material/Person";
import ConnectionStatus from "@/Components/Layout/ConnectionStatus";
import NotificationBell from "@/Components/Layout/NotificationBell";
import { SnackbarProvider } from "@/Contexts/SnackbarContext";
import { WebSocketProvider, useWebSocket } from "@/Contexts/WebSocketContext";

const DRAWER_WIDTH = 280;
const COLLAPSED_WIDTH = 64;

interface AuthenticatedLayoutProps {
    header?: ReactNode;
    currentTeam?: Team;
    sidebarBoards?: Team["boards"];
    activeBoardId?: string;
}

export default function AuthenticatedLayout(
    props: PropsWithChildren<AuthenticatedLayoutProps>,
) {
    return (
        <WebSocketProvider>
            <SnackbarProvider>
                <SidebarProvider
                    currentTeamOverride={props.currentTeam}
                    sidebarBoardsOverride={props.sidebarBoards}
                >
                    <AuthenticatedLayoutInner {...props} />
                </SidebarProvider>
            </SnackbarProvider>
        </WebSocketProvider>
    );
}

function AuthenticatedLayoutInner({
    header,
    children,
    activeBoardId,
}: PropsWithChildren<AuthenticatedLayoutProps>) {
    const pageProps = usePage<PageProps>().props;
    const { auth } = pageProps;
    const user = auth.user;
    const { collapsed } = useSidebar();
    const { setMode } = useThemeMode();
    const { reconnectVersion } = useWebSocket();
    const themeSynced = useRef(false);

    const drawerWidth = collapsed ? COLLAPSED_WIDTH : DRAWER_WIDTH;

    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const [mobileOpen, setMobileOpen] = useState(false);
    const [navigating, setNavigating] = useState(false);

    // Sync server-side theme preference to ThemeContext on first load
    useEffect(() => {
        if (!themeSynced.current && user.theme_preference) {
            const stored = localStorage.getItem("pulseboard-theme");
            if (!stored) {
                setMode(user.theme_preference);
            }
            themeSynced.current = true;
        }
    }, [user.theme_preference, setMode]);

    useEffect(() => {
        const removeStart = router.on("start", () => setNavigating(true));
        const removeFinish = router.on("finish", () => setNavigating(false));

        return () => {
            removeStart();
            removeFinish();
        };
    }, []);

    // Fallback: any page mounted in this layout gets a refresh on reconnect
    // so it picks up events missed during the disconnect. Pages that subscribe
    // to reconnectVersion themselves (e.g. Boards/Show, Tasks/Show) may do
    // narrower partial reloads in addition; both are idempotent. Inertia v2
    // router.reload always preserves state and scroll.
    useEffect(() => {
        if (reconnectVersion === 0) return;
        router.reload();
    }, [reconnectVersion]);

    const menuOpen = Boolean(anchorEl);

    const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
        setAnchorEl(event.currentTarget);
    };

    const handleMenuClose = () => {
        setAnchorEl(null);
    };

    const handleLogout = () => {
        handleMenuClose();
        router.post(route("logout"));
    };

    const handleProfile = () => {
        handleMenuClose();
        router.get(route("profile.edit"));
    };

    const handleDrawerToggle = () => {
        setMobileOpen((prev) => !prev);
    };

    return (
        <Box
            sx={{
                display: "flex",
                minHeight: "100vh",
                bgcolor: "background.default",
                color: "text.primary",
            }}
        >
            {/* Skip navigation link */}
            <Box
                component="a"
                href="#main-content"
                sx={{
                    position: "absolute",
                    left: "-9999px",
                    top: "auto",
                    width: "1px",
                    height: "1px",
                    overflow: "hidden",
                    "&:focus": {
                        position: "fixed",
                        top: 8,
                        left: 8,
                        width: "auto",
                        height: "auto",
                        overflow: "visible",
                        zIndex: 9999,
                        bgcolor: "background.paper",
                        color: "primary.main",
                        px: 2,
                        py: 1,
                        borderRadius: 1,
                        boxShadow: 3,
                        fontWeight: 600,
                        textDecoration: "none",
                        fontSize: "0.875rem",
                    },
                }}
            >
                Skip to main content
            </Box>

            {/* Sidebar - permanent on desktop, temporary on mobile */}
            <Box
                component="nav"
                sx={{
                    width: { md: drawerWidth },
                    flexShrink: { md: 0 },
                    transition: "width 225ms cubic-bezier(0.4, 0, 0.6, 1)",
                }}
            >
                {/* Mobile drawer — always full-width, unaffected by collapse */}
                <Drawer
                    variant="temporary"
                    open={mobileOpen}
                    onClose={handleDrawerToggle}
                    ModalProps={{ keepMounted: true }}
                    sx={{
                        display: { xs: "block", md: "none" },
                        "& .MuiDrawer-paper": {
                            boxSizing: "border-box",
                            width: DRAWER_WIDTH,
                            borderRight: 1,
                            borderColor: "divider",
                        },
                    }}
                >
                    <Sidebar activeBoardId={activeBoardId} forceExpanded />
                </Drawer>

                {/* Desktop drawer */}
                <Drawer
                    variant="permanent"
                    sx={{
                        display: { xs: "none", md: "block" },
                        "& .MuiDrawer-paper": {
                            boxSizing: "border-box",
                            width: drawerWidth,
                            borderRight: 1,
                            borderColor: "divider",
                            transition:
                                "width 225ms cubic-bezier(0.4, 0, 0.6, 1)",
                            overflowX: "hidden",
                        },
                    }}
                    open
                >
                    <Sidebar activeBoardId={activeBoardId} />
                </Drawer>
            </Box>

            {/* Main content area */}
            <Box
                sx={{
                    flexGrow: 1,
                    display: "flex",
                    flexDirection: "column",
                    width: { md: `calc(100% - ${drawerWidth}px)` },
                    transition: "width 225ms cubic-bezier(0.4, 0, 0.6, 1)",
                }}
            >
                {/* Top AppBar */}
                <AppBar
                    position="sticky"
                    component="header"
                    color="default"
                    elevation={0}
                    sx={{
                        bgcolor: "background.default",
                        borderBottom: 1,
                        borderColor: "divider",
                        backdropFilter: "blur(18px)",
                    }}
                >
                    <Box role="status" aria-live="polite">
                        {navigating && (
                            <LinearProgress
                                aria-label="Page loading"
                                sx={{
                                    position: "absolute",
                                    top: 0,
                                    left: 0,
                                    right: 0,
                                    zIndex: 1,
                                    height: 2,
                                }}
                            />
                        )}
                        {navigating && (
                            <Typography
                                sx={{ position: "absolute", left: "-9999px" }}
                            >
                                Loading page
                            </Typography>
                        )}
                    </Box>
                    <Toolbar
                        sx={{
                            alignItems: "flex-start",
                            display: "grid",
                            gridTemplateColumns: {
                                xs: "auto 1fr auto",
                                md: "minmax(0, 1fr) auto",
                            },
                            gap: 2,
                            px: { xs: 2, lg: 4 },
                            py: header ? 1.25 : 1.25,
                        }}
                    >
                        <IconButton
                            color="inherit"
                            edge="start"
                            onClick={handleDrawerToggle}
                            sx={{ display: { md: "none" } }}
                            aria-label="Open navigation menu"
                        >
                            <MenuIcon />
                        </IconButton>

                        {header ? (
                            <Box sx={{ minWidth: 0 }}>{header}</Box>
                        ) : (
                            <Box />
                        )}

                        {/* Connection status + User menu */}
                        <Box
                            sx={{
                                display: "flex",
                                alignItems: "center",
                                gap: 1.5,
                                justifySelf: "end",
                                pt: header ? 0.5 : 0,
                            }}
                        >
                            <ConnectionStatus />
                            <NotificationBell />
                            <IconButton
                                onClick={handleMenuOpen}
                                size="small"
                                aria-controls={
                                    menuOpen ? "user-menu" : undefined
                                }
                                aria-haspopup="true"
                                aria-expanded={menuOpen ? "true" : undefined}
                            >
                                <Avatar
                                    src={user.avatar_url}
                                    alt={user.name}
                                    sx={{
                                        width: 40,
                                        height: 40,
                                        bgcolor: "secondary.main",
                                        fontWeight: 800,
                                    }}
                                >
                                    {user.name
                                        .split(/\s+/)
                                        .slice(0, 2)
                                        .map((part) => part.charAt(0))
                                        .join("")
                                        .toUpperCase()}
                                </Avatar>
                            </IconButton>
                        </Box>

                        <Menu
                            id="user-menu"
                            anchorEl={anchorEl}
                            open={menuOpen}
                            onClose={handleMenuClose}
                            anchorOrigin={{
                                vertical: "bottom",
                                horizontal: "right",
                            }}
                            transformOrigin={{
                                vertical: "top",
                                horizontal: "right",
                            }}
                            slotProps={{
                                paper: {
                                    elevation: 3,
                                    sx: { minWidth: 180, mt: 1 },
                                },
                            }}
                        >
                            <MenuItem onClick={handleProfile}>
                                <ListItemIcon>
                                    <PersonIcon fontSize="small" />
                                </ListItemIcon>
                                <ListItemText>Profile</ListItemText>
                            </MenuItem>
                            <Divider />
                            <MenuItem onClick={handleLogout}>
                                <ListItemIcon>
                                    <LogoutIcon fontSize="small" />
                                </ListItemIcon>
                                <ListItemText>Log Out</ListItemText>
                            </MenuItem>
                        </Menu>
                    </Toolbar>
                </AppBar>

                {/* Page content */}
                <Box
                    component="main"
                    role="main"
                    id="main-content"
                    sx={{
                        flexGrow: 1,
                        bgcolor: "background.default",
                        px: { xs: 2, lg: 4 },
                        pt: header ? 1.5 : 3,
                        pb: 3,
                        overflow: "hidden",
                    }}
                >
                    {children}
                </Box>
            </Box>
        </Box>
    );
}
