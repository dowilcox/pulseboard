import { PRIORITY_COLORS } from '@/constants/priorities';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import type { Team } from '@/types';
import { Head, usePage } from '@inertiajs/react';
import { Link as InertiaLink } from '@inertiajs/react';
import DownloadIcon from '@mui/icons-material/Download';
import Box from '@mui/material/Box';
import Breadcrumbs from '@mui/material/Breadcrumbs';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Link from '@mui/material/Link';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Grid from '@mui/material/Grid2';
import { useEffect, useState } from 'react';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
    LineChart,
    Line,
    Legend,
} from 'recharts';

interface ColumnStat {
    column_name: string;
    is_done_column: boolean;
    count: number;
}

interface WorkloadItem {
    name: string;
    task_count: number;
    total_effort: number;
}

interface VelocityItem {
    week: number;
    completed: number;
}

interface OverdueTask {
    id: string;
    title: string;
    task_number?: number;
    due_date: string;
    board?: { id: string; name: string };
    column?: { name: string };
    assignees?: { id: string; name: string }[];
}

interface Stats {
    tasks_by_column: ColumnStat[];
    tasks_by_priority: Record<string, number>;
    overdue_tasks: OverdueTask[];
    workload: WorkloadItem[];
    velocity: VelocityItem[];
    cycle_time: number;
}

const PRIORITY_LABELS: Record<string, string> = {
    urgent: 'Urgent',
    high: 'High',
    medium: 'Medium',
    low: 'Low',
    none: 'None',
};

interface Props {
    team: Team;
}

export default function TeamDashboard({ team }: Props) {
    const [stats, setStats] = useState<Stats | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch(route('teams.dashboard.stats', team.id), {
            headers: { Accept: 'application/json' },
        })
            .then((res) => res.json())
            .then((data: Stats) => {
                setStats(data);
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, [team.id]);

    const priorityData = stats
        ? Object.entries(stats.tasks_by_priority).map(([key, value]) => ({
              name: PRIORITY_LABELS[key] ?? key,
              value,
              color: PRIORITY_COLORS[key] ?? '#9ca3af',
          }))
        : [];

    const columnData = stats
        ? stats.tasks_by_column.map((c) => ({
              name: c.column_name,
              count: c.count,
              isDone: c.is_done_column,
          }))
        : [];

    const velocityData = stats
        ? stats.velocity.map((v) => ({
              week: String(v.week).slice(-2),
              completed: v.completed,
          }))
        : [];

    return (
        <AuthenticatedLayout
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
                                Dashboard
                            </Typography>
                        </Breadcrumbs>
                        <Typography variant="h6" component="h2" fontWeight={600}>
                            {team.name} Dashboard
                        </Typography>
                    </Box>
                    <Button
                        variant="outlined"
                        size="small"
                        startIcon={<DownloadIcon />}
                        href={route('teams.export.csv', team.id)}
                    >
                        Export CSV
                    </Button>
                </Box>
            }
        >
            <Head title={`${team.name} - Dashboard`} />

            {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
                    <CircularProgress />
                </Box>
            ) : stats ? (
                <Grid container spacing={3}>
                    {/* Summary cards */}
                    <Grid size={{ xs: 6, md: 3 }}>
                        <Paper variant="outlined" sx={{ p: 2, textAlign: 'center' }}>
                            <Typography variant="subtitle2" color="text.secondary">
                                Total Tasks
                            </Typography>
                            <Typography variant="h4" fontWeight={700}>
                                {stats.tasks_by_column.reduce((s, c) => s + c.count, 0)}
                            </Typography>
                        </Paper>
                    </Grid>
                    <Grid size={{ xs: 6, md: 3 }}>
                        <Paper variant="outlined" sx={{ p: 2, textAlign: 'center' }}>
                            <Typography variant="subtitle2" color="text.secondary">
                                Completed
                            </Typography>
                            <Typography variant="h4" fontWeight={700} color="success.main">
                                {stats.tasks_by_column
                                    .filter((c) => c.is_done_column)
                                    .reduce((s, c) => s + c.count, 0)}
                            </Typography>
                        </Paper>
                    </Grid>
                    <Grid size={{ xs: 6, md: 3 }}>
                        <Paper
                            variant="outlined"
                            sx={{
                                p: 2,
                                textAlign: 'center',
                                borderLeft: stats.overdue_tasks.length > 0 ? 3 : 0,
                                borderColor: 'error.main',
                            }}
                        >
                            <Typography variant="subtitle2" color="text.secondary">
                                Overdue
                            </Typography>
                            <Typography
                                variant="h4"
                                fontWeight={700}
                                color={stats.overdue_tasks.length > 0 ? 'error' : 'text.primary'}
                            >
                                {stats.overdue_tasks.length}
                            </Typography>
                        </Paper>
                    </Grid>
                    <Grid size={{ xs: 6, md: 3 }}>
                        <Paper variant="outlined" sx={{ p: 2, textAlign: 'center' }}>
                            <Typography variant="subtitle2" color="text.secondary">
                                Avg Cycle Time
                            </Typography>
                            <Typography variant="h4" fontWeight={700}>
                                {stats.cycle_time}
                                <Typography component="span" variant="body2" color="text.secondary">
                                    {' '}days
                                </Typography>
                            </Typography>
                        </Paper>
                    </Grid>

                    {/* Tasks by Column */}
                    <Grid size={{ xs: 12, md: 6 }}>
                        <Paper variant="outlined" sx={{ p: 2 }}>
                            <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>
                                Tasks by Status
                            </Typography>
                            <ResponsiveContainer width="100%" height={250}>
                                <BarChart data={columnData}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                                    <YAxis allowDecimals={false} />
                                    <Tooltip />
                                    <Bar dataKey="count" fill={PRIORITY_COLORS.medium} radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </Paper>
                    </Grid>

                    {/* Tasks by Priority */}
                    <Grid size={{ xs: 12, md: 6 }}>
                        <Paper variant="outlined" sx={{ p: 2 }}>
                            <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>
                                Tasks by Priority
                            </Typography>
                            <ResponsiveContainer width="100%" height={250}>
                                <PieChart>
                                    <Pie
                                        data={priorityData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={50}
                                        outerRadius={90}
                                        dataKey="value"
                                        label={({ name, value }) => `${name}: ${value}`}
                                    >
                                        {priorityData.map((entry, i) => (
                                            <Cell key={i} fill={entry.color} />
                                        ))}
                                    </Pie>
                                    <Tooltip />
                                </PieChart>
                            </ResponsiveContainer>
                        </Paper>
                    </Grid>

                    {/* Velocity */}
                    <Grid size={{ xs: 12, md: 6 }}>
                        <Paper variant="outlined" sx={{ p: 2 }}>
                            <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>
                                Velocity (Tasks Completed per Week)
                            </Typography>
                            {velocityData.length > 0 ? (
                                <ResponsiveContainer width="100%" height={250}>
                                    <LineChart data={velocityData}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="week" tick={{ fontSize: 12 }} />
                                        <YAxis allowDecimals={false} />
                                        <Tooltip />
                                        <Line
                                            type="monotone"
                                            dataKey="completed"
                                            stroke="#10b981"
                                            strokeWidth={2}
                                            dot={{ fill: '#10b981' }}
                                        />
                                    </LineChart>
                                </ResponsiveContainer>
                            ) : (
                                <Box sx={{ py: 6, textAlign: 'center' }}>
                                    <Typography color="text.secondary">
                                        No velocity data yet
                                    </Typography>
                                </Box>
                            )}
                        </Paper>
                    </Grid>

                    {/* Workload Distribution */}
                    <Grid size={{ xs: 12, md: 6 }}>
                        <Paper variant="outlined" sx={{ p: 2 }}>
                            <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>
                                Workload Distribution
                            </Typography>
                            {stats.workload.length > 0 ? (
                                <ResponsiveContainer width="100%" height={250}>
                                    <BarChart data={stats.workload} layout="vertical">
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis type="number" allowDecimals={false} />
                                        <YAxis dataKey="name" type="category" tick={{ fontSize: 12 }} width={100} />
                                        <Tooltip />
                                        <Legend />
                                        <Bar dataKey="task_count" name="Tasks" fill={PRIORITY_COLORS.medium} radius={[0, 4, 4, 0]} />
                                        <Bar dataKey="total_effort" name="Effort" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            ) : (
                                <Box sx={{ py: 6, textAlign: 'center' }}>
                                    <Typography color="text.secondary">
                                        No workload data
                                    </Typography>
                                </Box>
                            )}
                        </Paper>
                    </Grid>

                    {/* Overdue Tasks */}
                    {stats.overdue_tasks.length > 0 && (
                        <Grid size={12}>
                            <Paper variant="outlined" sx={{ p: 2 }}>
                                <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }} color="error">
                                    Overdue Tasks
                                </Typography>
                                <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <Box component="thead">
                                        <Box component="tr">
                                            <Box component="th" sx={{ textAlign: 'left', p: 1, borderBottom: 1, borderColor: 'divider' }}>
                                                <Typography variant="caption" fontWeight={600}>Task</Typography>
                                            </Box>
                                            <Box component="th" sx={{ textAlign: 'left', p: 1, borderBottom: 1, borderColor: 'divider' }}>
                                                <Typography variant="caption" fontWeight={600}>Board</Typography>
                                            </Box>
                                            <Box component="th" sx={{ textAlign: 'left', p: 1, borderBottom: 1, borderColor: 'divider' }}>
                                                <Typography variant="caption" fontWeight={600}>Status</Typography>
                                            </Box>
                                            <Box component="th" sx={{ textAlign: 'left', p: 1, borderBottom: 1, borderColor: 'divider' }}>
                                                <Typography variant="caption" fontWeight={600}>Due Date</Typography>
                                            </Box>
                                            <Box component="th" sx={{ textAlign: 'left', p: 1, borderBottom: 1, borderColor: 'divider' }}>
                                                <Typography variant="caption" fontWeight={600}>Assignees</Typography>
                                            </Box>
                                        </Box>
                                    </Box>
                                    <Box component="tbody">
                                        {stats.overdue_tasks.map((task) => (
                                            <Box
                                                component="tr"
                                                key={task.id}
                                                sx={{ '&:hover': { bgcolor: 'action.hover' } }}
                                            >
                                                <Box component="td" sx={{ p: 1, borderBottom: 1, borderColor: 'divider' }}>
                                                    <Typography variant="body2">
                                                        {task.task_number ? `PB-${task.task_number} ` : ''}
                                                        {task.title}
                                                    </Typography>
                                                </Box>
                                                <Box component="td" sx={{ p: 1, borderBottom: 1, borderColor: 'divider' }}>
                                                    <Typography variant="body2" color="text.secondary">
                                                        {task.board?.name ?? ''}
                                                    </Typography>
                                                </Box>
                                                <Box component="td" sx={{ p: 1, borderBottom: 1, borderColor: 'divider' }}>
                                                    <Typography variant="body2" color="text.secondary">
                                                        {task.column?.name ?? ''}
                                                    </Typography>
                                                </Box>
                                                <Box component="td" sx={{ p: 1, borderBottom: 1, borderColor: 'divider' }}>
                                                    <Typography variant="body2" color="error">
                                                        {new Date(task.due_date).toLocaleDateString(undefined, {
                                                            month: 'short',
                                                            day: 'numeric',
                                                        })}
                                                    </Typography>
                                                </Box>
                                                <Box component="td" sx={{ p: 1, borderBottom: 1, borderColor: 'divider' }}>
                                                    <Typography variant="body2" color="text.secondary">
                                                        {(task.assignees ?? []).map((a) => a.name).join(', ')}
                                                    </Typography>
                                                </Box>
                                            </Box>
                                        ))}
                                    </Box>
                                </Box>
                            </Paper>
                        </Grid>
                    )}
                </Grid>
            ) : (
                <Paper variant="outlined" sx={{ p: 3, textAlign: 'center' }}>
                    <Typography color="text.secondary">
                        Failed to load dashboard stats
                    </Typography>
                </Paper>
            )}
        </AuthenticatedLayout>
    );
}
