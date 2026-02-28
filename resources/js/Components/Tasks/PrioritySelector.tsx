import type { Task } from '@/types';
import { router } from '@inertiajs/react';
import FlagIcon from '@mui/icons-material/Flag';
import Box from '@mui/material/Box';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import type { SelectChangeEvent } from '@mui/material/Select';

const PRIORITIES = [
    { value: 'urgent', label: 'Urgent', color: '#ef4444' },
    { value: 'high', label: 'High', color: '#f97316' },
    { value: 'medium', label: 'Medium', color: '#3b82f6' },
    { value: 'low', label: 'Low', color: '#9ca3af' },
    { value: 'none', label: 'None', color: '#d1d5db' },
] as const;

interface Props {
    task: Task;
    teamId: string;
    boardId: string;
}

export default function PrioritySelector({ task, teamId, boardId }: Props) {
    const handleChange = (e: SelectChangeEvent) => {
        router.put(
            route('tasks.update', [teamId, boardId, task.id]),
            { priority: e.target.value },
            { preserveScroll: true }
        );
    };

    return (
        <Select
            value={task.priority}
            onChange={handleChange}
            size="small"
            fullWidth
            renderValue={(value) => {
                const p = PRIORITIES.find((pr) => pr.value === value);
                return (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <FlagIcon sx={{ fontSize: 16, color: p?.color }} />
                        {p?.label}
                    </Box>
                );
            }}
        >
            {PRIORITIES.map((p) => (
                <MenuItem key={p.value} value={p.value}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <FlagIcon sx={{ fontSize: 16, color: p.color }} />
                        {p.label}
                    </Box>
                </MenuItem>
            ))}
        </Select>
    );
}
