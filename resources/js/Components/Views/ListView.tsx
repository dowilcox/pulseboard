import { useMemo, useState } from 'react';
import { PRIORITY_COLORS } from '@/constants/priorities';
import type { Column, Task } from '@/types';
import MergeRequestChip from '@/Components/Gitlab/MergeRequestChip';
import Avatar from '@mui/material/Avatar';
import AvatarGroup from '@mui/material/AvatarGroup';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TableSortLabel from '@mui/material/TableSortLabel';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';

type SortKey = 'task_number' | 'title' | 'priority' | 'due_date' | 'column' | 'assignees';
type SortDir = 'asc' | 'desc';

const PRIORITY_ORDER: Record<string, number> = {
    urgent: 1,
    high: 2,
    medium: 3,
    low: 4,
    none: 5,
};

interface Props {
    columns: Column[];
    filterFn: (task: Task) => boolean;
    onTaskClick: (task: Task) => void;
}

export default function ListView({ columns, filterFn, onTaskClick }: Props) {
    const [sortKey, setSortKey] = useState<SortKey>('task_number');
    const [sortDir, setSortDir] = useState<SortDir>('asc');

    const columnMap = useMemo(() => {
        const m: Record<string, Column> = {};
        for (const col of columns) {
            m[col.id] = col;
        }
        return m;
    }, [columns]);

    const allTasks = useMemo(() => {
        const tasks: Task[] = [];
        for (const col of columns) {
            for (const task of col.tasks ?? []) {
                tasks.push(task);
            }
        }
        return tasks.filter(filterFn);
    }, [columns, filterFn]);

    const sortedTasks = useMemo(() => {
        return [...allTasks].sort((a, b) => {
            let cmp = 0;
            switch (sortKey) {
                case 'task_number':
                    cmp = (a.task_number ?? 0) - (b.task_number ?? 0);
                    break;
                case 'title':
                    cmp = a.title.localeCompare(b.title);
                    break;
                case 'priority':
                    cmp = (PRIORITY_ORDER[a.priority] ?? 5) - (PRIORITY_ORDER[b.priority] ?? 5);
                    break;
                case 'due_date':
                    cmp = (a.due_date ?? '9999').localeCompare(b.due_date ?? '9999');
                    break;
                case 'column': {
                    const colA = columnMap[a.column_id]?.name ?? '';
                    const colB = columnMap[b.column_id]?.name ?? '';
                    cmp = colA.localeCompare(colB);
                    break;
                }
                case 'assignees':
                    cmp = (a.assignees?.length ?? 0) - (b.assignees?.length ?? 0);
                    break;
            }
            return sortDir === 'asc' ? cmp : -cmp;
        });
    }, [allTasks, sortKey, sortDir, columnMap]);

    const handleSort = (key: SortKey) => {
        if (sortKey === key) {
            setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
        } else {
            setSortKey(key);
            setSortDir('asc');
        }
    };

    const renderSortLabel = (key: SortKey, label: string) => (
        <TableSortLabel
            active={sortKey === key}
            direction={sortKey === key ? sortDir : 'asc'}
            onClick={() => handleSort(key)}
        >
            {label}
        </TableSortLabel>
    );

    return (
        <TableContainer component={Paper} variant="outlined">
            <Table size="small">
                <TableHead>
                    <TableRow>
                        <TableCell sx={{ width: 80 }}>{renderSortLabel('task_number', '#')}</TableCell>
                        <TableCell>{renderSortLabel('title', 'Title')}</TableCell>
                        <TableCell sx={{ width: 120 }}>{renderSortLabel('column', 'Status')}</TableCell>
                        <TableCell sx={{ width: 100 }}>{renderSortLabel('priority', 'Priority')}</TableCell>
                        <TableCell sx={{ width: 120 }}>{renderSortLabel('due_date', 'Due Date')}</TableCell>
                        <TableCell sx={{ width: 150 }}>{renderSortLabel('assignees', 'Assignees')}</TableCell>
                        <TableCell sx={{ width: 140 }}>Labels</TableCell>
                        <TableCell sx={{ width: 100 }}>GitLab</TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {sortedTasks.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                                <Typography color="text.secondary">No tasks found</Typography>
                            </TableCell>
                        </TableRow>
                    ) : (
                        sortedTasks.map((task) => {
                            const col = columnMap[task.column_id];
                            return (
                                <TableRow
                                    key={task.id}
                                    hover
                                    sx={{ cursor: 'pointer' }}
                                    onClick={() => onTaskClick(task)}
                                >
                                    <TableCell>
                                        <Typography variant="body2" color="text.secondary">
                                            #{task.task_number}
                                        </Typography>
                                    </TableCell>
                                    <TableCell>
                                        <Typography variant="body2" fontWeight={500}>
                                            {task.title}
                                        </Typography>
                                    </TableCell>
                                    <TableCell>
                                        {col && (
                                            <Chip
                                                label={col.name}
                                                size="small"
                                                sx={{
                                                    bgcolor: col.color,
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
                                                    new Date(task.due_date) < new Date()
                                                        ? 'error'
                                                        : 'text.secondary'
                                                }
                                            >
                                                {new Date(task.due_date).toLocaleDateString(undefined, {
                                                    month: 'short',
                                                    day: 'numeric',
                                                    year: 'numeric',
                                                })}
                                            </Typography>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        {task.assignees && task.assignees.length > 0 && (
                                            <AvatarGroup
                                                max={3}
                                                sx={{
                                                    '& .MuiAvatar-root': {
                                                        width: 24,
                                                        height: 24,
                                                        fontSize: '0.7rem',
                                                    },
                                                }}
                                            >
                                                {task.assignees.map((u) => (
                                                    <Avatar key={u.id} alt={u.name} src={u.avatar_url}>
                                                        {u.name.charAt(0)}
                                                    </Avatar>
                                                ))}
                                            </AvatarGroup>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                                            {(task.labels ?? []).map((label) => (
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
                                    <TableCell onClick={(e) => e.stopPropagation()}>
                                        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                                            {(task.gitlab_links ?? [])
                                                .filter((l) => l.link_type === 'merge_request')
                                                .map((link) => (
                                                    <MergeRequestChip key={link.id} link={link} />
                                                ))}
                                        </Box>
                                    </TableCell>
                                </TableRow>
                            );
                        })
                    )}
                </TableBody>
            </Table>
        </TableContainer>
    );
}
