import { useMemo, useState } from 'react';
import { PRIORITY_COLORS } from '@/constants/priorities';
import type { Column, Task } from '@/types';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Tooltip from '@mui/material/Tooltip';
import IconButton from '@mui/material/IconButton';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';

interface Props {
    columns: Column[];
    filterFn: (task: Task) => boolean;
    onTaskClick: (task: Task) => void;
}

function getWeekDates(startDate: Date, weeks: number): Date[] {
    const dates: Date[] = [];
    const d = new Date(startDate);
    d.setDate(d.getDate() - d.getDay()); // Start from Sunday
    for (let i = 0; i < weeks * 7; i++) {
        dates.push(new Date(d));
        d.setDate(d.getDate() + 1);
    }
    return dates;
}

function dateToOffset(date: string, startDate: Date, totalDays: number): number {
    const d = new Date(date);
    const diff = (d.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
    return Math.max(0, Math.min(diff / totalDays, 1)) * 100;
}

export default function TimelineView({ columns, filterFn, onTaskClick }: Props) {
    const [weekOffset, setWeekOffset] = useState(0);
    const WEEKS_TO_SHOW = 8;

    const startDate = useMemo(() => {
        const d = new Date();
        d.setDate(d.getDate() - d.getDay() + weekOffset * 7);
        d.setHours(0, 0, 0, 0);
        return d;
    }, [weekOffset]);

    const dates = useMemo(() => getWeekDates(startDate, WEEKS_TO_SHOW), [startDate]);
    const totalDays = WEEKS_TO_SHOW * 7;

    const endDate = useMemo(() => {
        const d = new Date(startDate);
        d.setDate(d.getDate() + totalDays);
        return d;
    }, [startDate, totalDays]);

    const allTasks = useMemo(() => {
        const tasks: Task[] = [];
        for (const col of columns) {
            for (const task of col.tasks ?? []) {
                tasks.push(task);
            }
        }
        return tasks.filter(filterFn).filter((t) => t.due_date || t.created_at);
    }, [columns, filterFn]);

    const columnMap = useMemo(() => {
        const m: Record<string, Column> = {};
        for (const col of columns) m[col.id] = col;
        return m;
    }, [columns]);

    // Group weeks for header
    const weeks = useMemo(() => {
        const w: { label: string; days: Date[] }[] = [];
        for (let i = 0; i < WEEKS_TO_SHOW; i++) {
            const weekDays = dates.slice(i * 7, (i + 1) * 7);
            const first = weekDays[0];
            w.push({
                label: first.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
                days: weekDays,
            });
        }
        return w;
    }, [dates]);

    const todayOffset = dateToOffset(new Date().toISOString().substring(0, 10), startDate, totalDays);

    return (
        <Box>
            {/* Navigation */}
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2, mb: 2 }}>
                <IconButton onClick={() => setWeekOffset((w) => w - WEEKS_TO_SHOW)} size="small">
                    <ChevronLeftIcon />
                </IconButton>
                <Typography variant="subtitle1" fontWeight={600}>
                    {dates[0].toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                    {' - '}
                    {dates[dates.length - 1].toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                </Typography>
                <IconButton onClick={() => setWeekOffset((w) => w + WEEKS_TO_SHOW)} size="small">
                    <ChevronRightIcon />
                </IconButton>
            </Box>

            <Box sx={{ position: 'relative', overflow: 'hidden' }}>
                {/* Week headers */}
                <Box sx={{ display: 'flex', borderBottom: 1, borderColor: 'divider' }}>
                    <Box sx={{ width: 200, flexShrink: 0, p: 1 }}>
                        <Typography variant="caption" fontWeight={600}>Task</Typography>
                    </Box>
                    <Box sx={{ flex: 1, display: 'flex' }}>
                        {weeks.map((week, i) => (
                            <Box
                                key={i}
                                sx={{
                                    flex: 1,
                                    textAlign: 'center',
                                    p: 0.5,
                                    borderLeft: 1,
                                    borderColor: 'divider',
                                }}
                            >
                                <Typography variant="caption" color="text.secondary">
                                    {week.label}
                                </Typography>
                            </Box>
                        ))}
                    </Box>
                </Box>

                {/* Task rows */}
                {allTasks.length === 0 ? (
                    <Box sx={{ py: 6, textAlign: 'center' }}>
                        <Typography color="text.secondary">No tasks with dates in this range</Typography>
                    </Box>
                ) : (
                    allTasks.map((task) => {
                        const taskStart = task.created_at.substring(0, 10);
                        const taskEnd = task.due_date ?? taskStart;
                        const col = columnMap[task.column_id];
                        const left = dateToOffset(taskStart, startDate, totalDays);
                        const right = dateToOffset(taskEnd, startDate, totalDays);
                        const width = Math.max(right - left, 1.5);

                        return (
                            <Box
                                key={task.id}
                                sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    borderBottom: 1,
                                    borderColor: 'divider',
                                    minHeight: 36,
                                    '&:hover': { bgcolor: 'action.hover' },
                                }}
                            >
                                <Box
                                    sx={{
                                        width: 200,
                                        flexShrink: 0,
                                        p: 1,
                                        cursor: 'pointer',
                                        overflow: 'hidden',
                                    }}
                                    onClick={() => onTaskClick(task)}
                                >
                                    <Typography variant="caption" noWrap>
                                        {task.task_number ? `PB-${task.task_number} ` : ''}{task.title}
                                    </Typography>
                                </Box>
                                <Box sx={{ flex: 1, position: 'relative', height: 28 }}>
                                    <Tooltip title={`${task.title} (${taskStart} - ${taskEnd})`}>
                                        <Box
                                            onClick={() => onTaskClick(task)}
                                            sx={{
                                                position: 'absolute',
                                                left: `${left}%`,
                                                width: `${width}%`,
                                                height: 20,
                                                top: 4,
                                                bgcolor: PRIORITY_COLORS[task.priority] ?? '#9ca3af',
                                                borderRadius: 1,
                                                cursor: 'pointer',
                                                opacity: 0.85,
                                                '&:hover': { opacity: 1 },
                                                display: 'flex',
                                                alignItems: 'center',
                                                px: 0.5,
                                                overflow: 'hidden',
                                            }}
                                        >
                                            <Typography
                                                variant="caption"
                                                sx={{ color: '#fff', fontSize: '0.6rem', whiteSpace: 'nowrap' }}
                                            >
                                                {task.title}
                                            </Typography>
                                        </Box>
                                    </Tooltip>
                                </Box>
                            </Box>
                        );
                    })
                )}

                {/* Today marker */}
                {todayOffset > 0 && todayOffset < 100 && (
                    <Box
                        sx={{
                            position: 'absolute',
                            left: `calc(200px + (100% - 200px) * ${todayOffset / 100})`,
                            top: 0,
                            bottom: 0,
                            width: 2,
                            bgcolor: 'error.main',
                            opacity: 0.6,
                            pointerEvents: 'none',
                        }}
                    />
                )}
            </Box>
        </Box>
    );
}
