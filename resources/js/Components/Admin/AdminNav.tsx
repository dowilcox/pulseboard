import { Link } from '@inertiajs/react';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import DashboardIcon from '@mui/icons-material/Dashboard';
import GroupsIcon from '@mui/icons-material/Groups';
import IntegrationInstructionsIcon from '@mui/icons-material/IntegrationInstructions';
import LockIcon from '@mui/icons-material/Lock';
import PeopleIcon from '@mui/icons-material/People';
import SettingsIcon from '@mui/icons-material/Settings';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import ListSubheader from '@mui/material/ListSubheader';

interface NavSection {
    label: string;
    items: { label: string; icon: React.ReactNode; route: string }[];
}

const navSections: NavSection[] = [
    {
        label: 'Overview',
        items: [
            { label: 'Dashboard', icon: <DashboardIcon />, route: 'admin.dashboard' },
        ],
    },
    {
        label: 'Management',
        items: [
            { label: 'Users', icon: <PeopleIcon />, route: 'admin.users.index' },
            { label: 'Teams', icon: <GroupsIcon />, route: 'admin.teams.index' },
        ],
    },
    {
        label: 'Integrations',
        items: [
            { label: 'GitLab', icon: <IntegrationInstructionsIcon />, route: 'admin.gitlab-connections.index' },
            { label: 'SSO', icon: <LockIcon />, route: 'admin.sso.index' },
        ],
    },
    {
        label: 'Configuration',
        items: [
            { label: 'Settings', icon: <SettingsIcon />, route: 'admin.settings.index' },
        ],
    },
];

export default function AdminNav() {
    return (
        <Box sx={{ minWidth: 200, mr: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2, px: 1 }}>
                <AdminPanelSettingsIcon sx={{ color: 'warning.main', fontSize: 20 }} />
                <Chip
                    label="Admin"
                    size="small"
                    color="warning"
                    variant="outlined"
                    sx={{ fontWeight: 600 }}
                />
            </Box>
            <List disablePadding>
                {navSections.map((section) => (
                    <Box key={section.label}>
                        <ListSubheader
                            disableSticky
                            sx={{
                                fontSize: '0.7rem',
                                fontWeight: 700,
                                textTransform: 'uppercase',
                                letterSpacing: '0.08em',
                                lineHeight: '32px',
                                color: 'text.secondary',
                                bgcolor: 'transparent',
                                px: 1,
                            }}
                        >
                            {section.label}
                        </ListSubheader>
                        {section.items.map((item) => (
                            <ListItemButton
                                key={item.route}
                                component={Link}
                                href={route(item.route)}
                                selected={route().current(item.route)}
                                sx={{ borderRadius: 1, mb: 0.5 }}
                            >
                                <ListItemIcon sx={{ minWidth: 36 }}>
                                    {item.icon}
                                </ListItemIcon>
                                <ListItemText primary={item.label} />
                            </ListItemButton>
                        ))}
                    </Box>
                ))}
            </List>
        </Box>
    );
}
