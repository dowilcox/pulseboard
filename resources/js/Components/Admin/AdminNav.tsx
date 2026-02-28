import { Link } from '@inertiajs/react';
import DashboardIcon from '@mui/icons-material/Dashboard';
import GroupsIcon from '@mui/icons-material/Groups';
import IntegrationInstructionsIcon from '@mui/icons-material/IntegrationInstructions';
import LockIcon from '@mui/icons-material/Lock';
import PeopleIcon from '@mui/icons-material/People';
import SettingsIcon from '@mui/icons-material/Settings';
import Box from '@mui/material/Box';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';

const navItems = [
    { label: 'Dashboard', icon: <DashboardIcon />, route: 'admin.dashboard' },
    { label: 'Users', icon: <PeopleIcon />, route: 'admin.users.index' },
    { label: 'Teams', icon: <GroupsIcon />, route: 'admin.teams.index' },
    { label: 'GitLab', icon: <IntegrationInstructionsIcon />, route: 'admin.gitlab-connections.index' },
    { label: 'SSO', icon: <LockIcon />, route: 'admin.sso.index' },
    { label: 'Settings', icon: <SettingsIcon />, route: 'admin.settings.index' },
];

export default function AdminNav() {
    return (
        <Box sx={{ minWidth: 200, mr: 3 }}>
            <List disablePadding>
                {navItems.map((item) => (
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
            </List>
        </Box>
    );
}
