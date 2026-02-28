import type { Task } from '@/types';
import { router, useForm } from '@inertiajs/react';
import AddIcon from '@mui/icons-material/Add';
import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import IconButton from '@mui/material/IconButton';
import LinearProgress from '@mui/material/LinearProgress';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { type FormEvent, useRef, useState } from 'react';

interface Props {
    task: Task;
    teamId: string;
    boardId: string;
    columnId: string;
    onSubtaskClick?: (subtask: Task) => void;
}

export default function SubtaskList({ task, teamId, boardId, columnId, onSubtaskClick }: Props) {
    const subtasks = task.subtasks ?? [];
    const total = subtasks.length;
    const completed = subtasks.filter((s) => s.completed_at !== null && s.completed_at !== undefined).length;
    const progress = total > 0 ? (completed / total) * 100 : 0;

    const [showForm, setShowForm] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    const { data, setData, post, processing, reset } = useForm({
        title: '',
        parent_task_id: task.id,
    });

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        if (!data.title.trim()) return;

        post(route('tasks.store', [teamId, boardId, columnId]), {
            preserveScroll: true,
            onSuccess: () => {
                reset('title');
                inputRef.current?.focus();
            },
        });
    };

    const handleToggleComplete = (subtask: Task, e: React.MouseEvent) => {
        e.stopPropagation();
        router.patch(
            route('tasks.toggle-complete', [teamId, boardId, subtask.id]),
            {},
            { preserveScroll: true },
        );
    };

    return (
        <Box>
            {total > 0 && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <LinearProgress
                        variant="determinate"
                        value={progress}
                        sx={{ flex: 1, height: 6, borderRadius: 3 }}
                    />
                    <Typography variant="caption" color="text.secondary">
                        {completed}/{total}
                    </Typography>
                </Box>
            )}

            <List dense disablePadding>
                {subtasks.map((subtask) => {
                    const isCompleted = subtask.completed_at !== null && subtask.completed_at !== undefined;
                    return (
                        <ListItem key={subtask.id} disablePadding>
                            <ListItemButton
                                onClick={() => onSubtaskClick?.(subtask)}
                                dense
                            >
                                <ListItemIcon sx={{ minWidth: 32 }}>
                                    <Checkbox
                                        edge="start"
                                        size="small"
                                        checked={isCompleted}
                                        onClick={(e) => handleToggleComplete(subtask, e)}
                                        tabIndex={-1}
                                        aria-label={`Mark ${subtask.title} as ${isCompleted ? 'incomplete' : 'complete'}`}
                                    />
                                </ListItemIcon>
                                <ListItemText
                                    primary={subtask.title}
                                    primaryTypographyProps={{
                                        variant: 'body2',
                                        sx: {
                                            textDecoration: isCompleted ? 'line-through' : 'none',
                                            color: isCompleted ? 'text.disabled' : 'text.primary',
                                        },
                                    }}
                                />
                            </ListItemButton>
                        </ListItem>
                    );
                })}
            </List>

            {showForm ? (
                <Box component="form" onSubmit={handleSubmit} sx={{ mt: 1 }}>
                    <TextField
                        inputRef={inputRef}
                        size="small"
                        fullWidth
                        autoFocus
                        placeholder="Subtask title..."
                        value={data.title}
                        onChange={(e) => setData('title', e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Escape') {
                                setShowForm(false);
                                reset('title');
                            }
                        }}
                        onBlur={() => {
                            if (!data.title.trim()) {
                                setShowForm(false);
                                reset('title');
                            }
                        }}
                        disabled={processing}
                    />
                </Box>
            ) : (
                <IconButton
                    size="small"
                    onClick={() => {
                        setShowForm(true);
                        setTimeout(() => inputRef.current?.focus(), 0);
                    }}
                    sx={{ mt: 0.5 }}
                >
                    <AddIcon fontSize="small" />
                    <Typography variant="caption" sx={{ ml: 0.5 }}>
                        Add subtask
                    </Typography>
                </IconButton>
            )}
        </Box>
    );
}
