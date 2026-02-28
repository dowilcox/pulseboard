import { PRIORITY_COLORS } from '@/constants/priorities';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import type { Task } from '@/types';
import { Head, router } from '@inertiajs/react';
import AssignmentIcon from '@mui/icons-material/Assignment';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import Avatar from '@mui/material/Avatar';
import AvatarGroup from '@mui/material/AvatarGroup';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import { useMemo } from 'react';

interface MyTask extends Task {
    board?: { id: string; name: string; team?: { id: string; name: string; slug: string } };
    column?: { id: string; name: string; color: string; is_done_column: boolean };
    comments_count?: number;
    subtasks_count?: number;
}

interface Props {
    myTasks: MyTask[];
}

export default function Dashboard({ myTasks }: Props) {
    const overdueTasks = useMemo(
        () =>
            myTasks.filter(
                (t) =>
                    t.due_date &&
                    new Date(t.due_date) < new Date() &&
                    !t.column?.is_done_column
            ),
        [myTasks]
    );

    const activeTasks = useMemo(
        () => myTasks.filter((t) => !t.column?.is_done_column),
        [myTasks]
    );

    const doneTasks = useMemo(
        () => myTasks.filter((t) => t.column?.is_done_column),
        [myTasks]
    );

    const handleTaskClick = (task: MyTask) => {
        if (task.board?.team?.id && task.board?.id) {
            router.get(route('teams.boards.show', [task.board.team.id, task.board.id]));
        }
    };

    return (
        <AuthenticatedLayout
            header={
                <Typography variant="h6" component="h2" fontWeight={600}>
                    Dashboard
                </Typography>
            }
        >
            <Head title="Dashboard" />

            {/* Summary stats */}
            <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
                <Paper variant="outlined" sx={{ p: 2, flex: 1, minWidth: 180 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                        <AssignmentIcon color="primary" fontSize="small" />
                        <Typography variant="subtitle2" color="text.secondary">
                            Active Tasks
                        </Typography>
                    </Box>
                    <Typography variant="h4" fontWeight={700}>
                        {activeTasks.length}
                    </Typography>
                </Paper>

                <Paper
                    variant="outlined"
                    sx={{
                        p: 2,
                        flex: 1,
                        minWidth: 180,
                        borderLeft: overdueTasks.length > 0 ? 3 : 0,
                        borderColor: 'error.main',
                    }}
                >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                        <WarningAmberIcon color={overdueTasks.length > 0 ? 'error' : 'disabled'} fontSize="small" />
                        <Typography variant="subtitle2" color="text.secondary">
                            Overdue
                        </Typography>
                    </Box>
                    <Typography variant="h4" fontWeight={700} color={overdueTasks.length > 0 ? 'error' : 'text.primary'}>
                        {overdueTasks.length}
                    </Typography>
                </Paper>

                <Paper variant="outlined" sx={{ p: 2, flex: 1, minWidth: 180 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                        <AssignmentIcon color="success" fontSize="small" />
                        <Typography variant="subtitle2" color="text.secondary">
                            Completed
                        </Typography>
                    </Box>
                    <Typography variant="h4" fontWeight={700}>
                        {doneTasks.length}
                    </Typography>
                </Paper>
            </Box>

            {/* My Tasks table */}
            <Typography variant="h6" fontWeight={600} sx={{ mb: 1.5 }}>
                My Tasks
            </Typography>

            <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                    <TableHead>
                        <TableRow>
                            <TableCell sx={{ width: 80 }}>#</TableCell>
                            <TableCell>Title</TableCell>
                            <TableCell sx={{ width: 140 }}>Board</TableCell>
                            <TableCell sx={{ width: 120 }}>Status</TableCell>
                            <TableCell sx={{ width: 100 }}>Priority</TableCell>
                            <TableCell sx={{ width: 120 }}>Due Date</TableCell>
                            <TableCell sx={{ width: 120 }}>Labels</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {myTasks.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                                    <Typography color="text.secondary">
                                        No tasks assigned to you
                                    </Typography>
                                </TableCell>
                            </TableRow>
                        ) : (
                            myTasks.map((task) => (
                                <TableRow
                                    key={task.id}
                                    hover
                                    sx={{
                                        cursor: 'pointer',
                                        opacity: task.column?.is_done_column ? 0.6 : 1,
                                    }}
                                    onClick={() => handleTaskClick(task)}
                                >
                                    <TableCell>
                                        <Typography variant="body2" color="text.secondary">
                                            {task.task_number ? `PB-${task.task_number}` : ''}
                                        </Typography>
                                    </TableCell>
                                    <TableCell>
                                        <Typography
                                            variant="body2"
                                            fontWeight={500}
                                            sx={{
                                                textDecoration: task.column?.is_done_column ? 'line-through' : 'none',
                                            }}
                                        >
                                            {task.title}
                                        </Typography>
                                    </TableCell>
                                    <TableCell>
                                        {task.board && (
                                            <Typography variant="body2" color="text.secondary" noWrap>
                                                {task.board.name}
                                            </Typography>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        {task.column && (
                                            <Chip
                                                label={task.column.name}
                                                size="small"
                                                sx={{
                                                    bgcolor: task.column.color,
                                                    color: '#fff',
                                                    height: 22,
                                                    fontSize: '0.7rem',
                                                }}
                                            />
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                            <Box
                                                sx={{
                                                    width: 8,
                                                    height: 8,
                                                    borderRadius: '50%',
                                                    bgcolor: PRIORITY_COLORS[task.priority] ?? 'transparent',
                                                    border: task.priority === 'none' ? '1px solid' : 'none',
                                                    borderColor: 'divider',
                                                }}
                                            />
                                            <Typography variant="body2" sx={{ textTransform: 'capitalize' }}>
                                                {task.priority}
                                            </Typography>
                                        </Box>
                                    </TableCell>
                                    <TableCell>
                                        {task.due_date && (
                                            <Typography
                                                variant="body2"
                                                color={
                                                    !task.column?.is_done_column && new Date(task.due_date) < new Date()
                                                        ? 'error'
                                                        : 'text.secondary'
                                                }
                                            >
                                                {new Date(task.due_date).toLocaleDateString(undefined, {
                                                    month: 'short',
                                                    day: 'numeric',
                                                })}
                                            </Typography>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                                            {(task.labels ?? []).slice(0, 2).map((label) => (
                                                <Chip
                                                    key={label.id}
                                                    label={label.name}
                                                    size="small"
                                                    sx={{
                                                        height: 18,
                                                        fontSize: '0.6rem',
                                                        bgcolor: label.color,
                                                        color: '#fff',
                                                    }}
                                                />
                                            ))}
                                        </Box>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </TableContainer>
        </AuthenticatedLayout>
    );
}
