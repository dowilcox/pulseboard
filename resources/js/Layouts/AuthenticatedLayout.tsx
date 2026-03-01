import { Link, usePage, router } from '@inertiajs/react';
import { type PropsWithChildren, type ReactNode, useEffect, useState } from 'react';
import type { PageProps, Team } from '@/types';
import { SidebarProvider, useSidebar } from '@/Contexts/SidebarContext';
import Sidebar from '@/Components/Layout/Sidebar';
import AppBar from '@mui/material/AppBar';
import LinearProgress from '@mui/material/LinearProgress';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import Drawer from '@mui/material/Drawer';
import IconButton from '@mui/material/IconButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import LogoutIcon from '@mui/icons-material/Logout';
import MenuIcon from '@mui/icons-material/Menu';
import PersonIcon from '@mui/icons-material/Person';
import ConnectionStatus from '@/Components/Layout/ConnectionStatus';
import NotificationBell from '@/Components/Layout/NotificationBell';

const DRAWER_WIDTH = 260;
const COLLAPSED_WIDTH = 64;

interface AuthenticatedLayoutProps {
    header?: ReactNode;
    currentTeam?: Team;
    activeBoardId?: string;
}

export default function AuthenticatedLayout(props: PropsWithChildren<AuthenticatedLayoutProps>) {
    return (
        <SidebarProvider
            currentTeamOverride={props.currentTeam}
            activeBoardId={props.activeBoardId}
        >
            <AuthenticatedLayoutInner {...props} />
        </SidebarProvider>
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

    const drawerWidth = collapsed ? COLLAPSED_WIDTH : DRAWER_WIDTH;

    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const [mobileOpen, setMobileOpen] = useState(false);
    const [navigating, setNavigating] = useState(false);

    useEffect(() => {
        const removeStart = router.on('start', () => setNavigating(true));
        const removeFinish = router.on('finish', () => setNavigating(false));

        return () => {
            removeStart();
            removeFinish();
        };
    }, []);

    const menuOpen = Boolean(anchorEl);

    const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
        setAnchorEl(event.currentTarget);
    };

    const handleMenuClose = () => {
        setAnchorEl(null);
    };

    const handleLogout = () => {
        handleMenuClose();
        router.post(route('logout'));
    };

    const handleProfile = () => {
        handleMenuClose();
        router.get(route('profile.edit'));
    };

    const handleDrawerToggle = () => {
        setMobileOpen((prev) => !prev);
    };

    return (
        <Box sx={{ display: 'flex', minHeight: '100vh' }}>
            {/* Sidebar - permanent on desktop, temporary on mobile */}
            <Box
                component="nav"
                sx={{
                    width: { md: drawerWidth },
                    flexShrink: { md: 0 },
                    transition: 'width 225ms cubic-bezier(0.4, 0, 0.6, 1)',
                }}
            >
                {/* Mobile drawer — always full-width, unaffected by collapse */}
                <Drawer
                    variant="temporary"
                    open={mobileOpen}
                    onClose={handleDrawerToggle}
                    ModalProps={{ keepMounted: true }}
                    sx={{
                        display: { xs: 'block', md: 'none' },
                        '& .MuiDrawer-paper': {
                            boxSizing: 'border-box',
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
                        display: { xs: 'none', md: 'block' },
                        '& .MuiDrawer-paper': {
                            boxSizing: 'border-box',
                            width: drawerWidth,
                            borderRight: 1,
                            borderColor: 'divider',
                            transition: 'width 225ms cubic-bezier(0.4, 0, 0.6, 1)',
                            overflowX: 'hidden',
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
                    display: 'flex',
                    flexDirection: 'column',
                    width: { md: `calc(100% - ${drawerWidth}px)` },
                    transition: 'width 225ms cubic-bezier(0.4, 0, 0.6, 1)',
                }}
            >
                {/* Top AppBar */}
                <AppBar
                    position="sticky"
                    color="default"
                    elevation={0}
                    sx={{
                        bgcolor: 'background.paper',
                        borderBottom: 1,
                        borderColor: 'divider',
                    }}
                >
                    {navigating && (
                        <LinearProgress
                            sx={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                right: 0,
                                zIndex: 1,
                                height: 2,
                            }}
                        />
                    )}
                    <Toolbar>
                        <IconButton
                            color="inherit"
                            edge="start"
                            onClick={handleDrawerToggle}
                            sx={{ mr: 2, display: { md: 'none' } }}
                        >
                            <MenuIcon />
                        </IconButton>

                        {/* Page header */}
                        {header && (
                            <Box sx={{ flexGrow: 1 }}>
                                {header}
                            </Box>
                        )}

                        {!header && <Box sx={{ flexGrow: 1 }} />}

                        {/* Connection status + User menu */}
                        <Box
                            sx={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 1.5,
                            }}
                        >
                            <ConnectionStatus />
                            <NotificationBell />
                            <Typography
                                variant="body2"
                                sx={{
                                    display: { xs: 'none', sm: 'block' },
                                    color: 'text.secondary',
                                }}
                            >
                                {user.name}
                            </Typography>
                            <IconButton
                                onClick={handleMenuOpen}
                                size="small"
                                aria-controls={menuOpen ? 'user-menu' : undefined}
                                aria-haspopup="true"
                                aria-expanded={menuOpen ? 'true' : undefined}
                            >
                                <Avatar
                                    src={user.avatar_url}
                                    alt={user.name}
                                    sx={{ width: 32, height: 32 }}
                                >
                                    {user.name.charAt(0).toUpperCase()}
                                </Avatar>
                            </IconButton>
                        </Box>

                        <Menu
                            id="user-menu"
                            anchorEl={anchorEl}
                            open={menuOpen}
                            onClose={handleMenuClose}
                            anchorOrigin={{
                                vertical: 'bottom',
                                horizontal: 'right',
                            }}
                            transformOrigin={{
                                vertical: 'top',
                                horizontal: 'right',
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
                    sx={{
                        flexGrow: 1,
                        bgcolor: 'background.default',
                        p: 3,
                    }}
                >
                    {children}
                </Box>
            </Box>
        </Box>
    );
}
