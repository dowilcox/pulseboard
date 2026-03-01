import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, useForm } from '@inertiajs/react';
import { useState } from 'react';
import type { Team } from '@/types';
import AddIcon from '@mui/icons-material/Add';
import GroupsIcon from '@mui/icons-material/Groups';
import Box from '@mui/material/Box';
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
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { router } from '@inertiajs/react';

interface IndexTeam extends Team {
    members_count?: number;
    boards_count?: number;
}

interface Props {
    pageTeams: IndexTeam[];
}

export default function TeamsIndex({ pageTeams: teams }: Props) {
    const [createOpen, setCreateOpen] = useState(false);

    const { data, setData, post, processing, errors, reset } = useForm({
        name: '',
        description: '',
    });

    const handleCreate = (e: React.FormEvent) => {
        e.preventDefault();
        post(route('teams.store'), {
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
            header={
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                    <Typography variant="h6" component="h2" fontWeight={600}>
                        Teams
                    </Typography>
                    <Button
                        variant="contained"
                        startIcon={<AddIcon />}
                        size="small"
                        onClick={() => setCreateOpen(true)}
                    >
                        Create Team
                    </Button>
                </Box>
            }
        >
            <Head title="Teams" />

            {teams.length === 0 ? (
                <Box
                    sx={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        py: 8,
                    }}
                >
                    <GroupsIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
                    <Typography variant="h6" color="text.secondary" gutterBottom>
                        No teams yet
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                        Create your first team to start collaborating.
                    </Typography>
                    <Button
                        variant="contained"
                        startIcon={<AddIcon />}
                        onClick={() => setCreateOpen(true)}
                    >
                        Create Team
                    </Button>
                </Box>
            ) : (
                <Grid container spacing={3}>
                    {teams.map((team) => (
                        <Grid size={{ xs: 12, sm: 6, md: 4 }} key={team.id}>
                            <Card variant="outlined" sx={{ transition: 'border-color 150ms ease, background-color 150ms ease', '&:hover': { borderColor: 'action.selected' } }}>
                                <CardActionArea
                                    onClick={() => router.get(route('teams.show', team.id))}
                                >
                                    <CardContent>
                                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                                            <Typography variant="h6" component="h3" fontWeight={600} noWrap sx={{ flex: 1 }}>
                                                {team.name}
                                            </Typography>
                                            {team.members?.[0]?.role && (
                                                <Chip
                                                    label={team.members[0].role}
                                                    size="small"
                                                    variant="outlined"
                                                    color={
                                                        team.members[0].role === 'owner'
                                                            ? 'primary'
                                                            : team.members[0].role === 'admin'
                                                              ? 'secondary'
                                                              : 'default'
                                                    }
                                                    sx={{ ml: 1 }}
                                                />
                                            )}
                                        </Box>

                                        {team.description && (
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
                                                {team.description}
                                            </Typography>
                                        )}

                                        <Box sx={{ display: 'flex', gap: 2 }}>
                                            <Typography variant="caption" color="text.secondary">
                                                {team.members_count ?? team.members?.length ?? 0} member{(team.members_count ?? team.members?.length ?? 0) !== 1 ? 's' : ''}
                                            </Typography>
                                            <Typography variant="caption" color="text.secondary">
                                                {team.boards_count ?? team.boards?.length ?? 0} board{(team.boards_count ?? team.boards?.length ?? 0) !== 1 ? 's' : ''}
                                            </Typography>
                                        </Box>
                                    </CardContent>
                                </CardActionArea>
                            </Card>
                        </Grid>
                    ))}
                </Grid>
            )}

            {/* Create Team Dialog */}
            <Dialog open={createOpen} onClose={handleClose} maxWidth="sm" fullWidth>
                <form onSubmit={handleCreate}>
                    <DialogTitle>Create Team</DialogTitle>
                    <DialogContent>
                        <TextField
                            autoFocus
                            label="Team Name"
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
