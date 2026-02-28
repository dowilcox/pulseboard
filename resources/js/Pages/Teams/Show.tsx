import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, useForm, router } from '@inertiajs/react';
import { useState } from 'react';
import type { Board, Team } from '@/types';
import AddIcon from '@mui/icons-material/Add';
import BarChartIcon from '@mui/icons-material/BarChart';
import DashboardIcon from '@mui/icons-material/Dashboard';
import GitlabIcon from '@mui/icons-material/AccountTree';
import ViewColumnIcon from '@mui/icons-material/ViewColumn';
import Box from '@mui/material/Box';
import Breadcrumbs from '@mui/material/Breadcrumbs';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Grid from '@mui/material/Grid2';
import Link from '@mui/material/Link';
import Paper from '@mui/material/Paper';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { Link as InertiaLink } from '@inertiajs/react';

interface Props {
    team: Team;
    boards: Board[];
    teams: Team[];
}

export default function TeamsShow({ team, boards, teams }: Props) {
    const [createOpen, setCreateOpen] = useState(false);

    const { data, setData, post, processing, errors, reset } = useForm({
        name: '',
        description: '',
    });

    const handleCreateBoard = (e: React.FormEvent) => {
        e.preventDefault();
        post(route('teams.boards.store', team.id), {
            onSuccess: () => {
                setCreateOpen(false);
                reset();
            },
        });
    };

    const handleClose = () => {
        setCreateOpen(false);
        reset();
    };

    return (
        <AuthenticatedLayout
            teams={teams}
            currentTeam={team}
            boards={boards}
            header={
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                    <Box>
                        <Breadcrumbs sx={{ mb: 0.5 }}>
                            <Link
                                component={InertiaLink}
                                href={route('teams.index')}
                                underline="hover"
                                color="text.secondary"
                                variant="body2"
                            >
                                Teams
                            </Link>
                            <Typography variant="body2" color="text.primary">
                                {team.name}
                            </Typography>
                        </Breadcrumbs>
                        <Typography variant="h6" component="h2" fontWeight={600}>
                            {team.name}
                        </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                        <Button
                            variant="outlined"
                            startIcon={<BarChartIcon />}
                            size="small"
                            onClick={() => router.get(route('teams.dashboard', team.id))}
                        >
                            Dashboard
                        </Button>
                        <Button
                            variant="outlined"
                            startIcon={<GitlabIcon />}
                            size="small"
                            onClick={() => router.get(route('teams.gitlab-projects.index', team.id))}
                        >
                            GitLab
                        </Button>
                        <Button
                            variant="contained"
                            startIcon={<AddIcon />}
                            size="small"
                            onClick={() => setCreateOpen(true)}
                        >
                            Create Board
                        </Button>
                    </Box>
                </Box>
            }
        >
            <Head title={team.name} />

            {/* Team info */}
            {team.description && (
                <Paper elevation={0} sx={{ p: 2, mb: 3, bgcolor: 'action.hover' }}>
                    <Typography variant="body2" color="text.secondary">
                        {team.description}
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 2, mt: 1 }}>
                        <Chip
                            label={`${team.members?.length ?? 0} member${(team.members?.length ?? 0) !== 1 ? 's' : ''}`}
                            size="small"
                            variant="outlined"
                        />
                    </Box>
                </Paper>
            )}

            {/* Boards grid */}
            {boards.length === 0 ? (
                <Box
                    sx={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        py: 8,
                    }}
                >
                    <DashboardIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
                    <Typography variant="h6" color="text.secondary" gutterBottom>
                        No boards yet
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                        Create your first board to start organizing tasks.
                    </Typography>
                    <Button
                        variant="contained"
                        startIcon={<AddIcon />}
                        onClick={() => setCreateOpen(true)}
                    >
                        Create Board
                    </Button>
                </Box>
            ) : (
                <Grid container spacing={3}>
                    {boards.map((board) => (
                        <Grid size={{ xs: 12, sm: 6, md: 4 }} key={board.id}>
                            <Card variant="outlined" sx={{ transition: 'border-color 150ms ease, background-color 150ms ease', '&:hover': { borderColor: 'action.selected' } }}>
                                <CardActionArea
                                    onClick={() =>
                                        router.get(route('teams.boards.show', [team.id, board.id]))
                                    }
                                >
                                    <CardContent>
                                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                                            <DashboardIcon
                                                fontSize="small"
                                                sx={{ color: 'primary.main', mr: 1 }}
                                            />
                                            <Typography
                                                variant="h6"
                                                component="h3"
                                                fontWeight={600}
                                                noWrap
                                                sx={{ flex: 1 }}
                                            >
                                                {board.name}
                                            </Typography>
                                        </Box>

                                        {board.description && (
                                            <Typography
                                                variant="body2"
                                                color="text.secondary"
                                                sx={{
                                                    mb: 2,
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                    display: '-webkit-box',
                                                    WebkitLineClamp: 2,
                                                    WebkitBoxOrient: 'vertical',
                                                }}
                                            >
                                                {board.description}
                                            </Typography>
                                        )}

                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                            <ViewColumnIcon fontSize="small" sx={{ color: 'text.disabled' }} />
                                            <Typography variant="caption" color="text.secondary">
                                                {board.columns?.length ?? 0} column{(board.columns?.length ?? 0) !== 1 ? 's' : ''}
                                            </Typography>
                                        </Box>
                                    </CardContent>
                                </CardActionArea>
                            </Card>
                        </Grid>
                    ))}
                </Grid>
            )}

            {/* Create Board Dialog */}
            <Dialog open={createOpen} onClose={handleClose} maxWidth="sm" fullWidth>
                <form onSubmit={handleCreateBoard}>
                    <DialogTitle>Create Board</DialogTitle>
                    <DialogContent>
                        <TextField
                            autoFocus
                            label="Board Name"
                            fullWidth
                            required
                            value={data.name}
                            onChange={(e) => setData('name', e.target.value)}
                            error={!!errors.name}
                            helperText={errors.name}
                            sx={{ mt: 1, mb: 2 }}
                        />
                        <TextField
                            label="Description"
                            fullWidth
                            multiline
                            rows={3}
                            value={data.description}
                            onChange={(e) => setData('description', e.target.value)}
                            error={!!errors.description}
                            helperText={errors.description}
                        />
                    </DialogContent>
                    <DialogActions sx={{ px: 3, py: 2 }}>
                        <Button onClick={handleClose}>Cancel</Button>
                        <Button type="submit" variant="contained" disabled={processing}>
                            Create
                        </Button>
                    </DialogActions>
                </form>
            </Dialog>
        </AuthenticatedLayout>
    );
}
