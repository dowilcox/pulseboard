import { useMemo } from 'react';
import type { Column, Task, User } from '@/types';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import LinearProgress from '@mui/material/LinearProgress';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';

const PRIORITY_COLORS: Record<string, string> = {
    urgent: '#ef4444',
    high: '#f97316',
    medium: '#3b82f6',
    low: '#9ca3af',
    none: '#e5e7eb',
};

interface Props {
    columns: Column[];
    members: User[];
    filterFn: (task: Task) => boolean;
    onTaskClick: (task: Task) => void;
}

interface MemberWorkload {
    user: User;
    tasks: Task[];
    totalEffort: number;
    byPriority: Record<string, number>;
}

export default function WorkloadView({ columns, members, filterFn, onTaskClick }: Props) {
    const allTasks = useMemo(() => {
        const tasks: Task[] = [];
        for (const col of columns) {
            for (const task of col.tasks ?? []) {
                tasks.push(task);
            }
        }
        return tasks.filter(filterFn);
    }, [columns, filterFn]);

    const doneColumnIds = useMemo(() => {
        const ids = new Set<string>();
        for (const col of columns) {
            if (col.is_done_column) ids.add(col.id);
        }
        return ids;
    }, [columns]);

    const workloads = useMemo(() => {
        const map = new Map<string, MemberWorkload>();

        for (const member of members) {
            map.set(member.id, {
                user: member,
                tasks: [],
                totalEffort: 0,
                byPriority: {},
            });
        }

        // Also track unassigned
        const unassigned: Task[] = [];

        for (const task of allTasks) {
            // Skip done tasks
            if (doneColumnIds.has(task.column_id)) continue;

            if (!task.assignees || task.assignees.length === 0) {
                unassigned.push(task);
                continue;
            }

            for (const assignee of task.assignees) {
                let wl = map.get(assignee.id);
                if (!wl) {
                    wl = {
                        user: assignee,
                        tasks: [],
                        totalEffort: 0,
                        byPriority: {},
                    };
                    map.set(assignee.id, wl);
                }
                wl.tasks.push(task);
                wl.totalEffort += task.effort_estimate ?? 1;
                wl.byPriority[task.priority] = (wl.byPriority[task.priority] ?? 0) + 1;
            }
        }

        const result = Array.from(map.values())
            .filter((w) => w.tasks.length > 0)
            .sort((a, b) => b.tasks.length - a.tasks.length);

        return { workloads: result, unassigned };
    }, [allTasks, members, doneColumnIds]);

    const maxTasks = Math.max(...workloads.workloads.map((w) => w.tasks.length), 1);

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {workloads.workloads.length === 0 && workloads.unassigned.length === 0 ? (
                <Box sx={{ py: 6, textAlign: 'center' }}>
                    <Typography color="text.secondary">No active tasks</Typography>
                </Box>
            ) : (
                <>
                    {workloads.workloads.map((wl) => (
                        <Paper key={wl.user.id} elevation={1} sx={{ p: 2 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1.5 }}>
                                <Avatar
                                    alt={wl.user.name}
                                    src={wl.user.avatar_url}
                                    sx={{ width: 36, height: 36 }}
                                >
                                    {wl.user.name.charAt(0)}
                                </Avatar>
                                <Box sx={{ flex: 1 }}>
                                    <Typography variant="subtitle2" fontWeight={600}>
                                        {wl.user.name}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                        {wl.tasks.length} task{wl.tasks.length !== 1 ? 's' : ''} &middot; {wl.totalEffort} effort points
                                    </Typography>
                                </Box>
                                <Box sx={{ display: 'flex', gap: 0.5 }}>
                                    {Object.entries(wl.byPriority).map(([priority, count]) => (
                                        <Chip
                                            key={priority}
                                            label={`${count} ${priority}`}
                                            size="small"
                                            sx={{
                                                height: 20,
                                                fontSize: '0.6rem',
                                                borderLeft: 3,
                                                borderColor: PRIORITY_COLORS[priority] ?? '#e5e7eb',
                                            }}
                                        />
                                    ))}
                                </Box>
                            </Box>
                            <LinearProgress
                                variant="determinate"
                                value={(wl.tasks.length / maxTasks) * 100}
                                sx={{ height: 6, borderRadius: 3, mb: 1.5 }}
                            />
                            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                                {wl.tasks.slice(0, 10).map((task) => (
                                    <Chip
                                        key={task.id}
                                        label={`${task.task_number ? `PB-${task.task_number}` : ''} ${task.title}`}
                                        size="small"
                                        onClick={() => onTaskClick(task)}
                                        sx={{
                                            cursor: 'pointer',
                                            borderLeft: 3,
                                            borderColor: PRIORITY_COLORS[task.priority] ?? '#e5e7eb',
                                            maxWidth: 200,
                                        }}
                                    />
                                ))}
                                {wl.tasks.length > 10 && (
                                    <Chip
                                        label={`+${wl.tasks.length - 10} more`}
                                        size="small"
                                        variant="outlined"
                                    />
                                )}
                            </Box>
                        </Paper>
                    ))}

                    {/* Unassigned tasks */}
                    {workloads.unassigned.length > 0 && (
                        <Paper elevation={1} sx={{ p: 2, bgcolor: 'action.hover' }}>
                            <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>
                                Unassigned ({workloads.unassigned.length})
                            </Typography>
                            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                                {workloads.unassigned.slice(0, 10).map((task) => (
                                    <Chip
                                        key={task.id}
                                        label={`${task.task_number ? `PB-${task.task_number}` : ''} ${task.title}`}
                                        size="small"
                                        onClick={() => onTaskClick(task)}
                                        sx={{
                                            cursor: 'pointer',
                                            borderLeft: 3,
                                            borderColor: PRIORITY_COLORS[task.priority] ?? '#e5e7eb',
                                            maxWidth: 200,
                                        }}
                                    />
                                ))}
                                {workloads.unassigned.length > 10 && (
                                    <Chip
                                        label={`+${workloads.unassigned.length - 10} more`}
                                        size="small"
                                        variant="outlined"
                                    />
                                )}
                            </Box>
                        </Paper>
                    )}
                </>
            )}
        </Box>
    );
}
