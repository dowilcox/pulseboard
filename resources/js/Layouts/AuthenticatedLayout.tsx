import { Link, usePage, router } from '@inertiajs/react';
import { type PropsWithChildren, type ReactNode, useEffect, useState } from 'react';
import type { Board, PageProps, Team } from '@/types';
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

interface AuthenticatedLayoutProps {
    header?: ReactNode;
    teams?: Team[];
    currentTeam?: Team;
    boards?: Board[];
    activeBoardId?: string;
}

export default function AuthenticatedLayout({
    header,
    children,
    teams: teamsProp,
    currentTeam: currentTeamProp,
    boards: boardsProp,
    activeBoardId: activeBoardIdProp,
}: PropsWithChildren<AuthenticatedLayoutProps>) {
    const pageProps = usePage<PageProps>().props;
    const { auth } = pageProps;
    const user = auth.user;

    // Use props if provided directly, otherwise fall back to shared Inertia page props
    const teams = teamsProp ?? pageProps.teams ?? [];
    const currentTeam = currentTeamProp ?? pageProps.currentTeam;
    const boards = boardsProp ?? currentTeam?.boards ?? [];
    const activeBoardId = activeBoardIdProp;

    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const [mobileOpen, setMobileOpen] = useState(false);
    const [navigating, setNavigating] = useState(false);

    useEffect(() => {
        const startHandler = () => setNavigating(true);
        const finishHandler = () => setNavigating(false);

        router.on('start', startHandler);
        router.on('finish', finishHandler);

        return () => {
            // Inertia event handlers are cleaned up by returning the removal function
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

    const sidebarContent = (
        <Sidebar
            teams={teams}
            currentTeam={currentTeam}
            boards={boards}
            activeBoardId={activeBoardId}
        />
    );

    return (
        <Box sx={{ display: 'flex', minHeight: '100vh' }}>
            {/* Sidebar - permanent on desktop, temporary on mobile */}
            <Box
                component="nav"
                sx={{ width: { md: DRAWER_WIDTH }, flexShrink: { md: 0 } }}
            >
                {/* Mobile drawer */}
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
                    {sidebarContent}
                </Drawer>

                {/* Desktop drawer */}
                <Drawer
                    variant="permanent"
                    sx={{
                        display: { xs: 'none', md: 'block' },
                        '& .MuiDrawer-paper': {
                            boxSizing: 'border-box',
                            width: DRAWER_WIDTH,
                            borderRight: 1,
                            borderColor: 'divider',
                        },
                    }}
                    open
                >
                    {sidebarContent}
                </Drawer>
            </Box>

            {/* Main content area */}
            <Box
                sx={{
                    flexGrow: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    width: { md: `calc(100% - ${DRAWER_WIDTH}px)` },
                }}
            >
                {/* Top AppBar */}
                <AppBar
                    position="sticky"
                    color="default"
                    elevation={1}
                    sx={{
                        bgcolor: 'background.paper',
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
                                gap: 1,
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
