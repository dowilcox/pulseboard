import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head } from '@inertiajs/react';
import { Link as InertiaLink } from '@inertiajs/react';
import type { Board, Team } from '@/types';
import SettingsIcon from '@mui/icons-material/Settings';
import Box from '@mui/material/Box';
import Breadcrumbs from '@mui/material/Breadcrumbs';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Link from '@mui/material/Link';
import Paper from '@mui/material/Paper';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { router } from '@inertiajs/react';

interface Props {
    board: Board;
    team: Team;
    teams: Team[];
    boards: Board[];
}

export default function BoardsShow({ board, team, teams, boards }: Props) {
    const columns = board.columns ?? [];

    return (
        <AuthenticatedLayout
            teams={teams}
            currentTeam={team}
            boards={boards}
            activeBoardId={board.id}
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
                            <Link
                                component={InertiaLink}
                                href={route('teams.show', team.id)}
                                underline="hover"
                                color="text.secondary"
                                variant="body2"
                            >
                                {team.name}
                            </Link>
                            <Typography variant="body2" color="text.primary">
                                {board.name}
                            </Typography>
                        </Breadcrumbs>
                        <Typography variant="h6" component="h2" fontWeight={600}>
                            {board.name}
                        </Typography>
                    </Box>
                    <Tooltip title="Board Settings">
                        <IconButton
                            onClick={() =>
                                router.get(route('teams.boards.settings', [team.id, board.id]))
                            }
                        >
                            <SettingsIcon />
                        </IconButton>
                    </Tooltip>
                </Box>
            }
        >
            <Head title={`${board.name} - ${team.name}`} />

            {/* Kanban columns */}
            <Box
                sx={{
                    display: 'flex',
                    gap: 2,
                    overflowX: 'auto',
                    pb: 2,
                    minHeight: 'calc(100vh - 200px)',
                    alignItems: 'flex-start',
                }}
            >
                {columns.length === 0 ? (
                    <Box
                        sx={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '100%',
                            py: 8,
                        }}
                    >
                        <Typography variant="h6" color="text.secondary" gutterBottom>
                            No columns configured
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                            Add columns in board settings to start organizing tasks.
                        </Typography>
                        <Chip
                            label="Open Settings"
                            onClick={() =>
                                router.get(route('teams.boards.settings', [team.id, board.id]))
                            }
                            clickable
                            color="primary"
                            variant="outlined"
                        />
                    </Box>
                ) : (
                    columns.map((column) => (
                        <Paper
                            key={column.id}
                            elevation={0}
                            sx={{
                                minWidth: 280,
                                maxWidth: 320,
                                flex: '0 0 280px',
                                bgcolor: 'action.hover',
                                borderRadius: 2,
                                display: 'flex',
                                flexDirection: 'column',
                            }}
                        >
                            {/* Column header */}
                            <Box
                                sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 1,
                                    p: 2,
                                    pb: 1.5,
                                }}
                            >
                                <Box
                                    sx={{
                                        width: 12,
                                        height: 12,
                                        borderRadius: '50%',
                                        bgcolor: column.color || '#9e9e9e',
                                        flexShrink: 0,
                                    }}
                                />
                                <Typography
                                    variant="subtitle2"
                                    fontWeight={700}
                                    sx={{ flex: 1 }}
                                    noWrap
                                >
                                    {column.name}
                                </Typography>
                                {column.wip_limit != null && column.wip_limit > 0 && (
                                    <Chip
                                        label={`WIP: ${column.wip_limit}`}
                                        size="small"
                                        variant="outlined"
                                        sx={{ height: 20, fontSize: '0.65rem' }}
                                    />
                                )}
                            </Box>

                            {/* Column body (empty for now) */}
                            <Box
                                sx={{
                                    p: 1.5,
                                    pt: 0.5,
                                    minHeight: 200,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: 1,
                                }}
                            >
                                <Typography
                                    variant="body2"
                                    color="text.disabled"
                                    sx={{ textAlign: 'center', py: 4 }}
                                >
                                    No tasks
                                </Typography>
                            </Box>
                        </Paper>
                    ))
                )}
            </Box>
        </AuthenticatedLayout>
    );
}
