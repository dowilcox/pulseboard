import { Head, Link } from '@inertiajs/react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import AdminNav from '@/Components/Admin/AdminNav';
import type { PageProps } from '@/types';
import DashboardIcon from '@mui/icons-material/Dashboard';
import GroupsIcon from '@mui/icons-material/Groups';
import IntegrationInstructionsIcon from '@mui/icons-material/IntegrationInstructions';
import PeopleIcon from '@mui/icons-material/People';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Grid from '@mui/material/Grid2';

interface Props extends PageProps {
    stats: {
        totalUsers: number;
        activeUsers: number;
        totalTeams: number;
        totalBoards: number;
        gitlabConnections: number;
    };
}

const statCards = [
    { key: 'totalUsers' as const, label: 'Total Users', icon: <PeopleIcon /> },
    { key: 'activeUsers' as const, label: 'Active Users', icon: <PeopleIcon /> },
    { key: 'totalTeams' as const, label: 'Teams', icon: <GroupsIcon /> },
    { key: 'totalBoards' as const, label: 'Boards', icon: <DashboardIcon /> },
    { key: 'gitlabConnections' as const, label: 'GitLab Connections', icon: <IntegrationInstructionsIcon /> },
];

export default function Dashboard({ stats }: Props) {
    return (
        <AuthenticatedLayout
            header={
                <Typography variant="h6" component="h2" fontWeight={600}>
                    Admin Dashboard
                </Typography>
            }
        >
            <Head title="Admin Dashboard" />

            <Box sx={{ display: 'flex' }}>
                <AdminNav />

                <Box sx={{ flex: 1 }}>
                    <Grid container spacing={3} sx={{ mb: 4 }}>
                        {statCards.map((card) => (
                            <Grid key={card.key} size={{ xs: 12, sm: 6, md: 4 }}>
                                <Card elevation={1}>
                                    <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                        <Box sx={{ color: 'primary.main' }}>
                                            {card.icon}
                                        </Box>
                                        <Box>
                                            <Typography variant="h4" fontWeight={700}>
                                                {stats[card.key]}
                                            </Typography>
                                            <Typography variant="body2" color="text.secondary">
                                                {card.label}
                                            </Typography>
                                        </Box>
                                    </CardContent>
                                </Card>
                            </Grid>
                        ))}
                    </Grid>

                    <Typography variant="h6" gutterBottom>
                        Quick Links
                    </Typography>
                    <Grid container spacing={2}>
                        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                            <Card
                                component={Link}
                                href={route('admin.users.index')}
                                elevation={1}
                                sx={{ textDecoration: 'none', display: 'block', '&:hover': { bgcolor: 'action.hover' } }}
                            >
                                <CardContent>
                                    <Typography variant="subtitle1" fontWeight={600}>
                                        Manage Users
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        Create, edit, and manage user accounts
                                    </Typography>
                                </CardContent>
                            </Card>
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                            <Card
                                component={Link}
                                href={route('admin.teams.index')}
                                elevation={1}
                                sx={{ textDecoration: 'none', display: 'block', '&:hover': { bgcolor: 'action.hover' } }}
                            >
                                <CardContent>
                                    <Typography variant="subtitle1" fontWeight={600}>
                                        Team Oversight
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        View teams, members, and boards
                                    </Typography>
                                </CardContent>
                            </Card>
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                            <Card
                                component={Link}
                                href={route('admin.settings.index')}
                                elevation={1}
                                sx={{ textDecoration: 'none', display: 'block', '&:hover': { bgcolor: 'action.hover' } }}
                            >
                                <CardContent>
                                    <Typography variant="subtitle1" fontWeight={600}>
                                        Organization Settings
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        Configure organization name and preferences
                                    </Typography>
                                </CardContent>
                            </Card>
                        </Grid>
                    </Grid>
                </Box>
            </Box>
        </AuthenticatedLayout>
    );
}
