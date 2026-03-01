import { Head } from '@inertiajs/react';
import { useState } from 'react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import AdminNav from '@/Components/Admin/AdminNav';
import type { Board, PageProps, Team, TeamMember } from '@/types';
import GroupsIcon from '@mui/icons-material/Groups';
import ViewKanbanIcon from '@mui/icons-material/ViewKanban';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';

interface TeamWithCounts extends Team {
    members_count: number;
    boards_count: number;
}

interface TeamDetail extends Team {
    members: TeamMember[];
    boards: Board[];
}

interface Props extends PageProps {
    adminTeams: TeamWithCounts[];
}

export default function Teams({ adminTeams: teams }: Props) {
    const [detailOpen, setDetailOpen] = useState(false);
    const [teamDetail, setTeamDetail] = useState<TeamDetail | null>(null);
    const [loading, setLoading] = useState(false);

    const handleRowClick = async (team: TeamWithCounts) => {
        setDetailOpen(true);
        setLoading(true);
        setTeamDetail(null);

        try {
            const response = await fetch(route('admin.teams.show', team.id), {
                headers: { Accept: 'application/json' },
            });
            const data = await response.json();
            setTeamDetail(data);
        } finally {
            setLoading(false);
        }
    };

    return (
        <AuthenticatedLayout
            header={
                <Typography variant="h6" component="h2" fontWeight={600}>
                    Team Oversight
                </Typography>
            }
        >
            <Head title="Team Oversight" />

            <Box sx={{ display: 'flex' }}>
                <AdminNav />

                <Box sx={{ flex: 1 }}>
                    {teams.length === 0 ? (
                        <Paper variant="outlined" sx={{ p: 4, textAlign: 'center' }}>
                            <Typography color="text.secondary">
                                No teams have been created yet.
                            </Typography>
                        </Paper>
                    ) : (
                        <TableContainer component={Paper} variant="outlined">
                            <Table>
                                <TableHead>
                                    <TableRow>
                                        <TableCell>Name</TableCell>
                                        <TableCell>Members</TableCell>
                                        <TableCell>Boards</TableCell>
                                        <TableCell>Created</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {teams.map((team) => (
                                        <TableRow
                                            key={team.id}
                                            hover
                                            sx={{ cursor: 'pointer' }}
                                            onClick={() => handleRowClick(team)}
                                        >
                                            <TableCell>
                                                <Typography fontWeight={500}>{team.name}</Typography>
                                                {team.description && (
                                                    <Typography variant="body2" color="text.secondary" noWrap sx={{ maxWidth: 300 }}>
                                                        {team.description}
                                                    </Typography>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                <Chip
                                                    icon={<GroupsIcon />}
                                                    label={team.members_count}
                                                    size="small"
                                                    variant="outlined"
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <Chip
                                                    icon={<ViewKanbanIcon />}
                                                    label={team.boards_count}
                                                    size="small"
                                                    variant="outlined"
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <Typography variant="body2" color="text.secondary">
                                                    {new Date(team.created_at).toLocaleDateString()}
                                                </Typography>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    )}
                </Box>
            </Box>

            {/* Team Detail Dialog */}
            <Dialog open={detailOpen} onClose={() => setDetailOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle>{teamDetail?.name ?? 'Team Details'}</DialogTitle>
                <DialogContent>
                    {loading ? (
                        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                            <CircularProgress />
                        </Box>
                    ) : teamDetail ? (
                        <Box>
                            <Typography variant="subtitle2" gutterBottom sx={{ mt: 1 }}>
                                Members ({teamDetail.members.length})
                            </Typography>
                            <List dense disablePadding>
                                {teamDetail.members.map((member) => (
                                    <ListItem key={member.id} disableGutters>
                                        <ListItemText
                                            primary={member.user?.name}
                                            secondary={member.user?.email}
                                        />
                                        <Chip label={member.role} size="small" variant="outlined" />
                                    </ListItem>
                                ))}
                            </List>

                            <Divider sx={{ my: 2 }} />

                            <Typography variant="subtitle2" gutterBottom>
                                Boards ({teamDetail.boards.length})
                            </Typography>
                            <List dense disablePadding>
                                {teamDetail.boards.map((board) => (
                                    <ListItem key={board.id} disableGutters>
                                        <ListItemText
                                            primary={board.name}
                                            secondary={`Created ${new Date(board.created_at).toLocaleDateString()}`}
                                        />
                                        {board.is_archived && (
                                            <Chip label="Archived" size="small" color="default" />
                                        )}
                                    </ListItem>
                                ))}
                                {teamDetail.boards.length === 0 && (
                                    <Typography variant="body2" color="text.secondary">
                                        No boards yet.
                                    </Typography>
                                )}
                            </List>
                        </Box>
                    ) : null}
                </DialogContent>
            </Dialog>
        </AuthenticatedLayout>
    );
}
