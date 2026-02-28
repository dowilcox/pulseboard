import { useMemo, useState } from 'react';
import { PRIORITY_COLORS } from '@/constants/priorities';
import type { Column, Task } from '@/types';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface Props {
    columns: Column[];
    filterFn: (task: Task) => boolean;
    onTaskClick: (task: Task) => void;
}

function getDaysInMonth(year: number, month: number): Date[] {
    const days: Date[] = [];
    const date = new Date(year, month, 1);
    while (date.getMonth() === month) {
        days.push(new Date(date));
        date.setDate(date.getDate() + 1);
    }
    return days;
}

function formatMonthYear(date: Date): string {
    return date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

function dateKey(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function CalendarView({ columns, filterFn, onTaskClick }: Props) {
    const [currentDate, setCurrentDate] = useState(() => new Date());
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const allTasks = useMemo(() => {
        const tasks: Task[] = [];
        for (const col of columns) {
            for (const task of col.tasks ?? []) {
                tasks.push(task);
            }
        }
        return tasks.filter(filterFn);
    }, [columns, filterFn]);

    const tasksByDate = useMemo(() => {
        const map: Record<string, Task[]> = {};
        for (const task of allTasks) {
            if (task.due_date) {
                const key = task.due_date.substring(0, 10);
                if (!map[key]) map[key] = [];
                map[key].push(task);
            }
        }
        return map;
    }, [allTasks]);

    const days = getDaysInMonth(year, month);
    const firstDayOfWeek = days[0].getDay();
    const totalCells = firstDayOfWeek + days.length;
    const rows = Math.ceil(totalCells / 7);

    const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
    const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
    const today = new Date();
    const todayKey = dateKey(today);

    return (
        <Box>
            {/* Month navigation */}
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2, mb: 2 }}>
                <IconButton onClick={prevMonth} size="small">
                    <ChevronLeftIcon />
                </IconButton>
                <Typography variant="h6" fontWeight={600}>
                    {formatMonthYear(currentDate)}
                </Typography>
                <IconButton onClick={nextMonth} size="small">
                    <ChevronRightIcon />
                </IconButton>
            </Box>

            {/* Calendar grid */}
            <Box
                sx={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(7, 1fr)',
                    border: 1,
                    borderColor: 'divider',
                    borderRadius: 1,
                    overflow: 'hidden',
                }}
            >
                {/* Weekday headers */}
                {WEEKDAYS.map((day) => (
                    <Box
                        key={day}
                        sx={{
                            p: 1,
                            textAlign: 'center',
                            bgcolor: 'action.hover',
                            borderBottom: 1,
                            borderColor: 'divider',
                        }}
                    >
                        <Typography variant="caption" fontWeight={600}>
                            {day}
                        </Typography>
                    </Box>
                ))}

                {/* Day cells */}
                {Array.from({ length: rows * 7 }, (_, i) => {
                    const dayIndex = i - firstDayOfWeek;
                    const day = days[dayIndex];
                    const isCurrentMonth = dayIndex >= 0 && dayIndex < days.length;
                    const key = day ? dateKey(day) : `empty-${i}`;
                    const dayTasks = day ? tasksByDate[dateKey(day)] ?? [] : [];
                    const isToday = day && dateKey(day) === todayKey;

                    return (
                        <Box
                            key={key}
                            sx={{
                                minHeight: 100,
                                p: 0.5,
                                borderBottom: 1,
                                borderRight: (i + 1) % 7 !== 0 ? 1 : 0,
                                borderColor: 'divider',
                                bgcolor: isCurrentMonth ? 'background.paper' : 'action.disabledBackground',
                            }}
                        >
                            {isCurrentMonth && day && (
                                <>
                                    <Typography
                                        variant="caption"
                                        sx={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            width: 24,
                                            height: 24,
                                            borderRadius: '50%',
                                            fontWeight: isToday ? 700 : 400,
                                            bgcolor: isToday ? 'primary.main' : 'transparent',
                                            color: isToday ? 'primary.contrastText' : 'text.primary',
                                        }}
                                    >
                                        {day.getDate()}
                                    </Typography>
                                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25, mt: 0.25 }}>
                                        {dayTasks.slice(0, 3).map((task) => (
                                            <Chip
                                                key={task.id}
                                                label={task.title}
                                                size="small"
                                                onClick={() => onTaskClick(task)}
                                                sx={{
                                                    height: 18,
                                                    fontSize: '0.6rem',
                                                    justifyContent: 'flex-start',
                                                    borderLeft: 3,
                                                    borderColor: PRIORITY_COLORS[task.priority] ?? '#e5e7eb',
                                                    borderRadius: 0.5,
                                                    cursor: 'pointer',
                                                    '& .MuiChip-label': {
                                                        overflow: 'hidden',
                                                        textOverflow: 'ellipsis',
                                                        whiteSpace: 'nowrap',
                                                        px: 0.5,
                                                    },
                                                }}
                                            />
                                        ))}
                                        {dayTasks.length > 3 && (
                                            <Typography variant="caption" color="text.secondary" sx={{ pl: 0.5 }}>
                                                +{dayTasks.length - 3} more
                                            </Typography>
                                        )}
                                    </Box>
                                </>
                            )}
                        </Box>
                    );
                })}
            </Box>
        </Box>
    );
}
