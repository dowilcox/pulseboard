import { usePage, router } from "@inertiajs/react";
import RouterLink from "@/Components/Common/RouterLink";
import {
    type PropsWithChildren,
    useCallback,
    useEffect,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import type { PageProps, Team } from "@/types";
import { LayoutHeaderSlotProvider } from "@/Components/Layout/LayoutHeader";
import { SidebarProvider, useSidebar } from "@/Contexts/SidebarContext";
import Sidebar from "@/Components/Layout/Sidebar";
import { APP_BAR_HEIGHT_VAR } from "@/Components/Layout/SidebarShared";
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
import QuickSwitcher from "@/Components/Layout/QuickSwitcher";
import { harbor, harborAvatarColor, harborHex } from "@/theme/harbor";
import { SnackbarProvider } from "@/Contexts/SnackbarContext";
import { WebSocketProvider, useWebSocket } from "@/Contexts/WebSocketContext";
import { pushRecentBoard } from "@/utils/recentBoards";
import { nameInitials } from "@/utils/sidebarNav";

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
 * persistent layout pattern, using the callback form when the layout needs
 * page props:
 *
 *     Page.layout = (props: Props) => [
 *         AuthenticatedLayout,
 *         { currentTeam: props.team },
 *     ];
 *
 * Don't read `page.props` inside a `(page) => <AuthenticatedLayout>...`
 * render function: Inertia v3 first calls it with the raw page props to
 * detect its form, so `page.props` is undefined on that call and throws.
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
    const { collapsed, refreshRecentBoards } = useSidebar();
    const { reconnectVersion } = useWebSocket();

    const drawerWidth = collapsed ? COLLAPSED_WIDTH : DRAWER_WIDTH;

    // The app bar grows with its page header (breadcrumbs, wrapped actions),
    // so publish its height for the sidebar's logo header to match — that
    // keeps both bottom borders on one continuous line on every page.
    const appBarRef = useRef<HTMLElement>(null);
    useLayoutEffect(() => {
        const el = appBarRef.current;
        if (!el) return;
        const root = document.documentElement;
        const apply = () =>
            root.style.setProperty(
                APP_BAR_HEIGHT_VAR,
                `${el.getBoundingClientRect().height}px`,
            );
        apply();
        if (typeof ResizeObserver === "undefined") return;
        const observer = new ResizeObserver(apply);
        observer.observe(el);
        return () => observer.disconnect();
    }, []);

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

    // Remember board visits for the sidebar's "Recent" section (and the
    // quick switcher), which re-read the list after each navigation.
    useEffect(() => {
        if (!activeBoardId) return;
        pushRecentBoard(activeBoardId);
        refreshRecentBoards();
    }, [activeBoardId, refreshRecentBoards]);

    // Fallback: any page mounted in this layout gets a refresh on reconnect
    // so it picks up events missed during the disconnect. Pages that subscribe
    // to reconnectVersion themselves (e.g. Boards/Show, Tasks/Show) may do
    // narrower partial reloads in addition; both are idempotent. Inertia's
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

            {/* Sidebar - permanent on desktop, temporary on mobile. The
                Sidebar itself renders the labelled <nav> landmark. */}
            <Box
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
                            maxWidth: "85vw",
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
                    // Without this the flex item grows to its widest child
                    // (e.g. a board's columns) and widens the whole page.
                    minWidth: 0,
                    width: { xs: "100%", md: `calc(100% - ${drawerWidth}px)` },
                    transition: "width 225ms cubic-bezier(0.4, 0, 0.6, 1)",
                }}
            >
                {/* Top AppBar */}
                <AppBar
                    ref={appBarRef}
                    position="sticky"
                    component="header"
                    color="default"
                    elevation={0}
                    sx={{
                        bgcolor: "background.default",
                        borderBottom: `1px solid ${harbor.chromeDivider}`,
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
                    {/* Phones: menu button + app actions on the first row and
                        the page header on its own full-width row, so the bell
                        and avatar never get pushed off-screen. */}
                    <Toolbar
                        sx={{
                            alignItems: { xs: "center", md: "flex-start" },
                            display: "grid",
                            gridTemplateColumns: {
                                xs: "auto minmax(0, 1fr) auto",
                                md: "minmax(0, 1fr) auto",
                            },
                            gridTemplateAreas: {
                                xs: '"menu . actions" "header header header"',
                                md: '"header actions"',
                            },
                            columnGap: 2,
                            rowGap: { xs: hasHeader ? 1 : 0, md: 0 },
                            px: { xs: 2, lg: 4 },
                            py: 1.25,
                        }}
                    >
                        <IconButton
                            color="inherit"
                            edge="start"
                            onClick={handleDrawerToggle}
                            sx={{ gridArea: "menu", display: { md: "none" } }}
                            aria-label="Open navigation menu"
                        >
                            <MenuIcon />
                        </IconButton>

                        {/* Header slot — pages portal content here via <LayoutHeader> */}
                        <Box
                            sx={{ gridArea: "header", minWidth: 0 }}
                            ref={setHeaderContainer}
                        />

                        {/* Quick switcher, connection status, bell, user menu */}
                        <Box
                            sx={{
                                gridArea: "actions",
                                display: "flex",
                                alignItems: "center",
                                gap: { xs: 1, sm: 1.5 },
                                justifySelf: "end",
                                minWidth: 0,
                                pt: { xs: 0, md: hasHeader ? 0.5 : 0 },
                            }}
                        >
                            <QuickSwitcher />
                            <ConnectionStatus />
                            <NotificationBell />
                            <IconButton
                                onClick={handleMenuOpen}
                                size="small"
                                aria-label="Account menu"
                                aria-controls={
                                    menuOpen ? "user-menu" : undefined
                                }
                                aria-haspopup="true"
                                aria-expanded={menuOpen ? "true" : undefined}
                            >
                                <Avatar
                                    src={user.avatar_url}
                                    alt=""
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
                                    {nameInitials(user.name)}
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
                            <MenuItem
                                component={RouterLink}
                                href={route("profile.edit")}
                                onClick={handleMenuClose}
                            >
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
                        minWidth: 0,
                        // Clip horizontally without creating a scroll
                        // container, so position: sticky still works inside.
                        overflowX: "clip",
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
