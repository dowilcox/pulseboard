import type { Task, TaskSummary } from '@/types';
import { router } from '@inertiajs/react';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import LockIcon from '@mui/icons-material/Lock';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import Autocomplete from '@mui/material/Autocomplete';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { useState } from 'react';

interface Props {
    task: Task;
    boardTasks: TaskSummary[];
    teamId: string;
    boardId: string;
}

export default function DependencySection({ task, boardTasks, teamId, boardId }: Props) {
    const [addingBlockedBy, setAddingBlockedBy] = useState(false);
    const [addingBlocking, setAddingBlocking] = useState(false);
    const [selectedTask, setSelectedTask] = useState<TaskSummary | null>(null);

    const blockedBy = task.blocked_by ?? [];
    const dependencies = task.dependencies ?? [];

    // Filter out already-linked tasks and self
    const availableForBlockedBy = boardTasks.filter(
        (t) => t.id !== task.id && !blockedBy.some((b) => b.id === t.id),
    );
    const availableForBlocking = boardTasks.filter(
        (t) => t.id !== task.id && !dependencies.some((d) => d.id === t.id),
    );

    const handleAddBlockedBy = (depTask: TaskSummary) => {
        router.post(
            route('tasks.dependencies.store', [teamId, boardId, task.id]),
            { depends_on_task_id: depTask.id },
            { preserveScroll: true },
        );
        setAddingBlockedBy(false);
        setSelectedTask(null);
    };

    const handleAddBlocking = (depTask: TaskSummary) => {
        router.post(
            route('tasks.dependencies.store', [teamId, boardId, depTask.id]),
            { depends_on_task_id: task.id },
            { preserveScroll: true },
        );
        setAddingBlocking(false);
        setSelectedTask(null);
    };

    const handleRemoveBlockedBy = (depTaskId: string) => {
        router.delete(
            route('tasks.dependencies.destroy', [teamId, boardId, task.id, depTaskId]),
            { preserveScroll: true },
        );
    };

    const handleRemoveBlocking = (depTaskId: string) => {
        router.delete(
            route('tasks.dependencies.destroy', [teamId, boardId, depTaskId, task.id]),
            { preserveScroll: true },
        );
    };

    const formatTaskLabel = (t: TaskSummary | Task) => {
        const num = t.task_number ? `#${t.task_number}` : '';
        return `${num} ${t.title}`.trim();
    };

    return (
        <Box>
            {/* Blocked By */}
            <Box sx={{ mb: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                    <LockIcon sx={{ fontSize: 16, color: 'warning.main' }} />
                    <Typography variant="caption" fontWeight={600} color="text.secondary">
                        Blocked By
                    </Typography>
                </Box>

                {blockedBy.length > 0 ? (
                    <List dense disablePadding>
                        {blockedBy.map((dep) => (
                            <ListItem
                                key={dep.id}
                                disablePadding
                                secondaryAction={
                                    <Tooltip title="Remove dependency">
                                        <IconButton
                                            size="small"
                                            onClick={() => handleRemoveBlockedBy(dep.id)}
                                            aria-label={`Remove blocked by ${formatTaskLabel(dep)}`}
                                        >
                                            <DeleteIcon sx={{ fontSize: 14 }} />
                                        </IconButton>
                                    </Tooltip>
                                }
                                sx={{ py: 0.25 }}
                            >
                                <ListItemText
                                    primary={formatTaskLabel(dep)}
                                    primaryTypographyProps={{ variant: 'body2' }}
                                />
                            </ListItem>
                        ))}
                    </List>
                ) : (
                    <Typography variant="body2" color="text.secondary" sx={{ ml: 0.5 }}>
                        None
                    </Typography>
                )}

                {addingBlockedBy ? (
                    <Box sx={{ mt: 0.5 }}>
                        <Autocomplete
                            size="small"
                            options={availableForBlockedBy}
                            getOptionLabel={formatTaskLabel}
                            value={selectedTask}
                            onChange={(_, value) => {
                                if (value) handleAddBlockedBy(value);
                            }}
                            renderInput={(params) => (
                                <TextField {...params} placeholder="Search tasks..." autoFocus />
                            )}
                            noOptionsText="No available tasks"
                        />
                        <Button size="small" onClick={() => setAddingBlockedBy(false)} sx={{ mt: 0.5 }}>
                            Cancel
                        </Button>
                    </Box>
                ) : (
                    <Button
                        size="small"
                        startIcon={<AddIcon />}
                        onClick={() => setAddingBlockedBy(true)}
                        sx={{ textTransform: 'none', color: 'text.secondary', mt: 0.5 }}
                    >
                        Add blocker
                    </Button>
                )}
            </Box>

            {/* Blocking */}
            <Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                    <LockOpenIcon sx={{ fontSize: 16, color: 'info.main' }} />
                    <Typography variant="caption" fontWeight={600} color="text.secondary">
                        Blocking
                    </Typography>
                </Box>

                {dependencies.length > 0 ? (
                    <List dense disablePadding>
                        {dependencies.map((dep) => (
                            <ListItem
                                key={dep.id}
                                disablePadding
                                secondaryAction={
                                    <Tooltip title="Remove dependency">
                                        <IconButton
                                            size="small"
                                            onClick={() => handleRemoveBlocking(dep.id)}
                                            aria-label={`Remove blocking ${formatTaskLabel(dep)}`}
                                        >
                                            <DeleteIcon sx={{ fontSize: 14 }} />
                                        </IconButton>
                                    </Tooltip>
                                }
                                sx={{ py: 0.25 }}
                            >
                                <ListItemText
                                    primary={formatTaskLabel(dep)}
                                    primaryTypographyProps={{ variant: 'body2' }}
                                />
                            </ListItem>
                        ))}
                    </List>
                ) : (
                    <Typography variant="body2" color="text.secondary" sx={{ ml: 0.5 }}>
                        None
                    </Typography>
                )}

                {addingBlocking ? (
                    <Box sx={{ mt: 0.5 }}>
                        <Autocomplete
                            size="small"
                            options={availableForBlocking}
                            getOptionLabel={formatTaskLabel}
                            value={selectedTask}
                            onChange={(_, value) => {
                                if (value) handleAddBlocking(value);
                            }}
                            renderInput={(params) => (
                                <TextField {...params} placeholder="Search tasks..." autoFocus />
                            )}
                            noOptionsText="No available tasks"
                        />
                        <Button size="small" onClick={() => setAddingBlocking(false)} sx={{ mt: 0.5 }}>
                            Cancel
                        </Button>
                    </Box>
                ) : (
                    <Button
                        size="small"
                        startIcon={<AddIcon />}
                        onClick={() => setAddingBlocking(true)}
                        sx={{ textTransform: 'none', color: 'text.secondary', mt: 0.5 }}
                    >
                        Add blocking
                    </Button>
                )}
            </Box>
        </Box>
    );
}
