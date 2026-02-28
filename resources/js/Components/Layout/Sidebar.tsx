import { Link, usePage } from '@inertiajs/react';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import AssignmentIcon from '@mui/icons-material/Assignment';
import GroupsIcon from '@mui/icons-material/Groups';
import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import MenuItem from '@mui/material/MenuItem';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import type { Board, PageProps, Team } from '@/types';
import BoardList from './BoardList';
import TeamSelector from './TeamSelector';

interface SidebarProps {
    teams: Team[];
    currentTeam?: Team;
    boards: Board[];
    activeBoardId?: string;
}

export default function Sidebar({ teams, currentTeam, boards, activeBoardId }: SidebarProps) {
    const { auth } = usePage<PageProps>().props;

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* Logo */}
            <Toolbar
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    px: 2,
                }}
            >
                <Link href={route('dashboard')} style={{ textDecoration: 'none' }}>
                    <Typography
                        variant="h5"
                        component="span"
                        sx={{
                            color: 'primary.main',
                            fontWeight: 700,
                            letterSpacing: '-0.02em',
                        }}
                    >
                        PulseBoard
                    </Typography>
                </Link>
            </Toolbar>

            <Divider />

            {/* My Tasks link */}
            <Box component="nav" aria-label="Main navigation" sx={{ pt: 1 }}>
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
            </Box>

            <Divider sx={{ my: 1.5 }} />

            {/* Team selector */}
            <TeamSelector teams={teams} currentTeam={currentTeam} />

            {/* Board list */}
            {currentTeam && (
                <BoardList
                    boards={boards}
                    teamId={currentTeam.id}
                    activeBoardId={activeBoardId}
                />
            )}

            <Box sx={{ flex: 1 }} />
        </Box>
    );
}
