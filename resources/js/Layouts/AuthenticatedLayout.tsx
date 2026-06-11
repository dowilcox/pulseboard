import { Link, usePage, router } from "@inertiajs/react";
import {
    type PropsWithChildren,
    useCallback,
    useEffect,
    useMemo,
    useState,
} from "react";
import type { PageProps, Team } from "@/types";
import { LayoutHeaderSlotProvider } from "@/Components/Layout/LayoutHeader";
import { SidebarProvider, useSidebar } from "@/Contexts/SidebarContext";
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
import { harborAvatarColor, harborHex } from "@/theme/harbor";
import { SnackbarProvider } from "@/Contexts/SnackbarContext";
import { WebSocketProvider, useWebSocket } from "@/Contexts/WebSocketContext";

const DRAWER_WIDTH = 280;
const COLLAPSED_WIDTH = 64;

interface AuthenticatedLayoutProps {
    currentTeam?: Team;
    sidebarBoards?: Team["boards"];
    activeBoardId?: string;
}

/**
 * Persistent layout for all authenticated pages.
 *
 * Pages must NOT render this inline; instead they assign it via Inertia's
 * persistent layout pattern:
 *
 *     Page.layout = (page) => (
 *         <AuthenticatedLayout currentTeam={page.props.team}>
 *             {page}
 *         </AuthenticatedLayout>
 *     );
 *
 * Because the layout element type stays identical across navigations, React
 * preserves this subtree — keeping WebSocketProvider (Echo connection),
 * SnackbarProvider and SidebarProvider mounted instead of tearing them down
 * and reconnecting on every page visit. Per-page header content is portalled
 * in via the <LayoutHeader> component rather than passed as a prop.
 */
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
    children,
    activeBoardId,
}: PropsWithChildren<AuthenticatedLayoutProps>) {
    const pageProps = usePage<PageProps>().props;
    const { auth } = pageProps;
    const user = auth.user;
    const { collapsed } = useSidebar();
    const { reconnectVersion } = useWebSocket();

    const drawerWidth = collapsed ? COLLAPSED_WIDTH : DRAWER_WIDTH;

    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const [mobileOpen, setMobileOpen] = useState(false);
    const [navigating, setNavigating] = useState(false);

    // Header slot: pages portal their header content here via <LayoutHeader>
    // so the layout never remounts when the header changes between pages.
    const [headerContainer, setHeaderContainer] = useState<HTMLElement | null>(
        null,
    );
    const [headerCount, setHeaderCount] = useState(0);
    const registerHeader = useCallback(() => {
        setHeaderCount((count) => count + 1);
        return () => setHeaderCount((count) => count - 1);
    }, []);
    const headerSlot = useMemo(
        () => ({ container: headerContainer, registerHeader }),
        [headerContainer, registerHeader],
    );
    const hasHeader = headerCount > 0;

    useEffect(() => {
        const removeStart = router.on("start", () => setNavigating(true));
        const removeFinish = router.on("finish", () => setNavigating(false));
        // The layout persists across navigations, so close the mobile drawer
        // explicitly (it previously closed as a side effect of remounting).
        const removeNavigate = router.on("navigate", () =>
            setMobileOpen(false),
        );

        return () => {
            removeStart();
            removeFinish();
            removeNavigate();
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
                            py: 1.25,
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

                        {/* Header slot — pages portal content here via <LayoutHeader> */}
                        <Box sx={{ minWidth: 0 }} ref={setHeaderContainer} />

                        {/* Connection status + User menu */}
                        <Box
                            sx={{
                                display: "flex",
                                alignItems: "center",
                                gap: 1.5,
                                justifySelf: "end",
                                pt: hasHeader ? 0.5 : 0,
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
                                        width: 30,
                                        height: 30,
                                        fontSize: "0.75rem",
                                        bgcolor: harborAvatarColor(user.name),
                                        color: "#ffffff",
                                        fontWeight: 800,
                                        boxShadow: `0 0 0 2px ${harborHex.canvas}`,
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
                        pt: hasHeader ? 1.5 : 3,
                        pb: 3,
                        overflow: "hidden",
                    }}
                >
                    <LayoutHeaderSlotProvider value={headerSlot}>
                        {children}
                    </LayoutHeaderSlotProvider>
                </Box>
            </Box>
        </Box>
    );
}
