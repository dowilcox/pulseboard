import { Link, router, usePage } from '@inertiajs/react';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import AssignmentIcon from '@mui/icons-material/Assignment';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import DashboardIcon from '@mui/icons-material/Dashboard';
import GroupsIcon from '@mui/icons-material/Groups';
import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import MenuItem from '@mui/material/MenuItem';
import Popover from '@mui/material/Popover';
import Toolbar from '@mui/material/Toolbar';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { useState } from 'react';
import type { PageProps } from '@/types';
import { useSidebar } from '@/Contexts/SidebarContext';
import Logo from '@/Components/Common/Logo';
import BoardList from './BoardList';
import TeamSelector from './TeamSelector';

interface SidebarProps {
    activeBoardId?: string;
    forceExpanded?: boolean;
}

export default function Sidebar({ activeBoardId, forceExpanded }: SidebarProps) {
    const { auth } = usePage<PageProps>().props;
    const { collapsed, setCollapsed, currentTeam, boards } = useSidebar();
    const [boardsAnchorEl, setBoardsAnchorEl] = useState<HTMLElement | null>(null);

    const isCollapsed = forceExpanded ? false : collapsed;

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* Logo */}
            <Toolbar
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: isCollapsed ? 'center' : 'center',
                    px: isCollapsed ? 0 : 2,
                    minHeight: 64,
                }}
            >
                <Link href={route('dashboard')} style={{ textDecoration: 'none' }}>
                    <Logo size="small" showText={!isCollapsed} />
                </Link>
            </Toolbar>

            <Divider />

            {/* Navigation links */}
            <Box component="nav" aria-label="Main navigation" sx={{ pt: 1 }}>
                {isCollapsed ? (
                    <>
                        <Tooltip title="My Tasks" placement="right">
                            <MenuItem
                                component={Link}
                                href={route('dashboard')}
                                selected={route().current('dashboard')}
                                aria-current={route().current('dashboard') ? 'page' : undefined}
                                sx={{ py: 1.5, px: 0, justifyContent: 'center' }}
                            >
                                <AssignmentIcon fontSize="small" />
                            </MenuItem>
                        </Tooltip>
                        <Tooltip title="Teams" placement="right">
                            <MenuItem
                                component={Link}
                                href={route('teams.index')}
                                selected={route().current('teams.index')}
                                aria-current={route().current('teams.index') ? 'page' : undefined}
                                sx={{ py: 1.5, px: 0, justifyContent: 'center' }}
                            >
                                <GroupsIcon fontSize="small" />
                            </MenuItem>
                        </Tooltip>
                        {auth.user.is_admin && (
                            <Tooltip title="Admin" placement="right">
                                <MenuItem
                                    component={Link}
                                    href={route('admin.dashboard')}
                                    selected={route().current('admin.*')}
                                    aria-current={route().current('admin.*') ? 'page' : undefined}
                                    sx={{ py: 1.5, px: 0, justifyContent: 'center' }}
                                >
                                    <AdminPanelSettingsIcon fontSize="small" />
                                </MenuItem>
                            </Tooltip>
                        )}
                    </>
                ) : (
                    <>
                        <MenuItem
                            component={Link}
                            href={route('dashboard')}
                            selected={route().current('dashboard')}
                            aria-current={route().current('dashboard') ? 'page' : undefined}
                            sx={{ py: 1.5, px: 2 }}
                        >
                            <ListItemIcon>
                                <AssignmentIcon fontSize="small" />
                            </ListItemIcon>
                            <ListItemText primary="My Tasks" />
                        </MenuItem>

                        <MenuItem
                            component={Link}
                            href={route('teams.index')}
                            selected={route().current('teams.index')}
                            aria-current={route().current('teams.index') ? 'page' : undefined}
                            sx={{ py: 1.5, px: 2 }}
                        >
                            <ListItemIcon>
                                <GroupsIcon fontSize="small" />
                            </ListItemIcon>
                            <ListItemText primary="Teams" />
                        </MenuItem>

                        {auth.user.is_admin && (
                            <MenuItem
                                component={Link}
                                href={route('admin.dashboard')}
                                selected={route().current('admin.*')}
                                aria-current={route().current('admin.*') ? 'page' : undefined}
                                sx={{ py: 1.5, px: 2 }}
                            >
                                <ListItemIcon>
                                    <AdminPanelSettingsIcon fontSize="small" />
                                </ListItemIcon>
                                <ListItemText primary="Admin" />
                            </MenuItem>
                        )}
                    </>
                )}
            </Box>

            <Divider sx={{ my: 1.5 }} />

            {/* Team selector */}
            <TeamSelector collapsed={isCollapsed} />

            {/* Board list */}
            {currentTeam && !isCollapsed && (
                <BoardList
                    boards={boards}
                    teamId={currentTeam.id}
                    activeBoardId={activeBoardId}
                />
            )}

            {/* Collapsed board list — icon button with popover */}
            {currentTeam && isCollapsed && boards.length > 0 && (
                <>
                    <Tooltip title="Boards" placement="right" disableHoverListener={Boolean(boardsAnchorEl)}>
                        <IconButton
                            size="small"
                            onClick={(e) => setBoardsAnchorEl(e.currentTarget)}
                            aria-label="Show boards"
                            sx={{
                                mx: 'auto',
                                mt: 0.5,
                                color: boardsAnchorEl ? 'primary.main' : 'text.secondary',
                            }}
                        >
                            <DashboardIcon fontSize="small" />
                        </IconButton>
                    </Tooltip>
                    <Popover
                        open={Boolean(boardsAnchorEl)}
                        anchorEl={boardsAnchorEl}
                        onClose={() => setBoardsAnchorEl(null)}
                        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
                        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
                        slotProps={{
                            paper: {
                                sx: { minWidth: 200, maxWidth: 280, py: 0.5 },
                            },
                        }}
                    >
                        <Box sx={{ px: 2, py: 0.75 }}>
                            <Typography
                                variant="overline"
                                color="text.secondary"
                                sx={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.1em' }}
                            >
                                Boards
                            </Typography>
                        </Box>
                        <List dense disablePadding>
                            {boards.map((board) => (
                                <ListItemButton
                                    key={board.id}
                                    selected={board.id === activeBoardId}
                                    onClick={() => {
                                        setBoardsAnchorEl(null);
                                        router.get(route('teams.boards.show', [currentTeam.id, board.id]));
                                    }}
                                    sx={{
                                        px: 2,
                                        py: 1,
                                        '&.Mui-selected': {
                                            bgcolor: 'action.selected',
                                            '&:hover': { bgcolor: 'action.selected' },
                                        },
                                    }}
                                >
                                    <ListItemIcon sx={{ minWidth: 32 }}>
                                        <DashboardIcon
                                            fontSize="small"
                                            color={board.id === activeBoardId ? 'primary' : 'action'}
                                        />
                                    </ListItemIcon>
                                    <ListItemText
                                        primary={board.name}
                                        primaryTypographyProps={{
                                            variant: 'body2',
                                            noWrap: true,
                                            fontWeight: board.id === activeBoardId ? 600 : 400,
                                        }}
                                    />
                                </ListItemButton>
                            ))}
                        </List>
                    </Popover>
                </>
            )}

            <Box sx={{ flex: 1 }} />

            {/* Collapse toggle — only on desktop (not in forceExpanded mobile drawer) */}
            {!forceExpanded && (
                <>
                    <Divider />
                    <Box sx={{ display: 'flex', justifyContent: isCollapsed ? 'center' : 'flex-end', p: 0.5 }}>
                        <Tooltip title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'} placement="right">
                            <IconButton size="small" onClick={() => setCollapsed(!isCollapsed)} aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
                                {isCollapsed ? <ChevronRightIcon fontSize="small" /> : <ChevronLeftIcon fontSize="small" />}
                            </IconButton>
                        </Tooltip>
                    </Box>
                </>
            )}
        </Box>
    );
}
