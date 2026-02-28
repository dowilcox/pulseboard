import GitlabSection from '@/Components/Gitlab/GitlabSection';
import ActivityFeed from '@/Components/Tasks/ActivityFeed';
import AssigneeSelector from '@/Components/Tasks/AssigneeSelector';
import AttachmentList from '@/Components/Tasks/AttachmentList';
import LabelSelector from '@/Components/Tasks/LabelSelector';
import PrioritySelector from '@/Components/Tasks/PrioritySelector';
import SubtaskList from '@/Components/Tasks/SubtaskList';
import type { BoardEvent } from '@/hooks/useBoardChannel';
import type { Activity, Attachment, Comment, GitlabProject, Label, Task, TaskGitlabLink, User } from '@/types';
import { router, usePage } from '@inertiajs/react';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import CloseIcon from '@mui/icons-material/Close';
import DeleteIcon from '@mui/icons-material/Delete';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Drawer from '@mui/material/Drawer';
import IconButton from '@mui/material/IconButton';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { useCallback, useEffect, useRef, useState } from 'react';

interface Props {
    task: Task | null;
    open: boolean;
    onClose: () => void;
    teamId: string;
    boardId: string;
    members: User[];
    labels: Label[];
    gitlabProjects?: GitlabProject[];
    lastBoardEvent?: BoardEvent | null;
}

interface TaskDetail extends Task {
    comments?: Comment[];
    activities?: Activity[];
    attachments?: Attachment[];
    creator?: User;
}

export default function TaskDetailPanel({
    task,
    open,
    onClose,
    teamId,
    boardId,
    members,
    labels,
    gitlabProjects = [],
    lastBoardEvent,
}: Props) {
    const { auth } = usePage().props as { auth: { user: User } };
    const [detail, setDetail] = useState<TaskDetail | null>(null);
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [dueDate, setDueDate] = useState('');
    const titleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const descTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Fetch full task details when opened
    useEffect(() => {
        if (!task || !open) {
            setDetail(null);
            return;
        }

        setTitle(task.title);
        setDescription(task.description ?? '');
        setDueDate(task.due_date ?? '');

        fetch(route('tasks.show', [teamId, boardId, task.id]), {
            headers: { Accept: 'application/json' },
        })
            .then((res) => res.json())
            .then((data: TaskDetail) => {
                setDetail(data);
                setTitle(data.title);
                setDescription(data.description ?? '');
                setDueDate(data.due_date ?? '');
            })
            .catch(() => {
                // Fall back to the task data we have
                setDetail(task as TaskDetail);
            });
    }, [task?.id, open]);

    // Re-fetch task detail when a relevant real-time event arrives
    useEffect(() => {
        if (!lastBoardEvent || !task || !open) return;
        const eventTaskId = lastBoardEvent.data.task_id;
        if (eventTaskId && eventTaskId !== task.id) return;

        const relevantActions = [
            'field_changed', 'assigned', 'unassigned', 'labels_changed',
            'commented', 'comment.updated', 'comment.deleted',
            'attachment_added', 'attachment_removed',
            'gitlab_branch_created', 'gitlab_mr_created', 'gitlab_mr_merged', 'gitlab_mr_closed',
        ];
        if (!relevantActions.includes(lastBoardEvent.action)) return;

        fetch(route('tasks.show', [teamId, boardId, task.id]), {
            headers: { Accept: 'application/json' },
        })
            .then((res) => res.json())
            .then((data: TaskDetail) => {
                setDetail(data);
                setTitle(data.title);
                setDescription(data.description ?? '');
                setDueDate(data.due_date ?? '');
            })
            .catch(() => {});
    }, [lastBoardEvent]);

    const saveTitle = useCallback(
        (newTitle: string) => {
            if (!task || !newTitle.trim()) return;
            if (titleTimeoutRef.current) clearTimeout(titleTimeoutRef.current);
            titleTimeoutRef.current = setTimeout(() => {
                router.put(
                    route('tasks.update', [teamId, boardId, task.id]),
                    { title: newTitle },
                    { preserveScroll: true }
                );
            }, 600);
        },
        [task?.id, teamId, boardId]
    );

    const saveDescription = useCallback(
        (newDesc: string) => {
            if (!task) return;
            if (descTimeoutRef.current) clearTimeout(descTimeoutRef.current);
            descTimeoutRef.current = setTimeout(() => {
                router.put(
                    route('tasks.update', [teamId, boardId, task.id]),
                    { description: newDesc || null },
                    { preserveScroll: true }
                );
            }, 800);
        },
        [task?.id, teamId, boardId]
    );

    const saveDueDate = (newDate: string) => {
        if (!task) return;
        router.put(
            route('tasks.update', [teamId, boardId, task.id]),
            { due_date: newDate || null },
            { preserveScroll: true }
        );
    };

    const handleDelete = () => {
        if (!task) return;
        router.delete(route('tasks.destroy', [teamId, boardId, task.id]), {
            preserveScroll: true,
            onSuccess: () => onClose(),
        });
    };

    const displayTask = detail ?? task;
    if (!displayTask) return null;

    return (
        <Drawer
            anchor="right"
            open={open}
            onClose={onClose}
            PaperProps={{
                sx: { width: { xs: '100%', sm: '50%', md: '40%' }, maxWidth: 600 },
            }}
        >
            <Box sx={{ p: 3, height: '100%', overflowY: 'auto' }}>
                {/* Header */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                    <Box sx={{ flex: 1, mr: 1 }}>
                        <TextField
                            fullWidth
                            variant="standard"
                            value={title}
                            onChange={(e) => {
                                setTitle(e.target.value);
                                saveTitle(e.target.value);
                            }}
                            InputProps={{
                                sx: { fontSize: '1.25rem', fontWeight: 600 },
                                disableUnderline: true,
                            }}
                        />
                        {displayTask.creator && (
                            <Typography variant="caption" color="text.secondary">
                                Created by {displayTask.creator.name}
                            </Typography>
                        )}
                    </Box>
                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                        <Tooltip title="Delete task">
                            <IconButton size="small" onClick={handleDelete} color="error">
                                <DeleteIcon fontSize="small" />
                            </IconButton>
                        </Tooltip>
                        <IconButton size="small" onClick={onClose}>
                            <CloseIcon />
                        </IconButton>
                    </Box>
                </Box>

                <Divider sx={{ mb: 2 }} />

                {/* Sidebar fields */}
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mb: 3 }}>
                    {/* Priority */}
                    <Box>
                        <Typography variant="caption" color="text.secondary" fontWeight={600}>
                            Priority
                        </Typography>
                        <PrioritySelector task={displayTask} teamId={teamId} boardId={boardId} />
                    </Box>

                    {/* Due date */}
                    <Box>
                        <Typography variant="caption" color="text.secondary" fontWeight={600}>
                            Due Date
                        </Typography>
                        <TextField
                            type="date"
                            size="small"
                            fullWidth
                            value={dueDate}
                            onChange={(e) => {
                                setDueDate(e.target.value);
                                saveDueDate(e.target.value);
                            }}
                            InputProps={{
                                startAdornment: <CalendarTodayIcon sx={{ fontSize: 16, mr: 1, color: 'text.secondary' }} />,
                            }}
                            InputLabelProps={{ shrink: true }}
                        />
                    </Box>

                    {/* Assignees */}
                    <Box>
                        <Typography variant="caption" color="text.secondary" fontWeight={600}>
                            Assignees
                        </Typography>
                        <AssigneeSelector
                            task={displayTask}
                            members={members}
                            teamId={teamId}
                            boardId={boardId}
                        />
                    </Box>

                    {/* Labels */}
                    <Box>
                        <Typography variant="caption" color="text.secondary" fontWeight={600}>
                            Labels
                        </Typography>
                        <LabelSelector
                            task={displayTask}
                            labels={labels}
                            teamId={teamId}
                            boardId={boardId}
                        />
                    </Box>
                </Box>

                <Divider sx={{ mb: 2 }} />

                {/* Description */}
                <Box sx={{ mb: 3 }}>
                    <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>
                        Description
                    </Typography>
                    <TextField
                        fullWidth
                        multiline
                        minRows={3}
                        placeholder="Add a description..."
                        value={description}
                        onChange={(e) => {
                            setDescription(e.target.value);
                            saveDescription(e.target.value);
                        }}
                        size="small"
                    />
                </Box>

                {/* Subtasks */}
                <Box sx={{ mb: 3 }}>
                    <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>
                        Subtasks
                    </Typography>
                    <SubtaskList
                        task={displayTask}
                        teamId={teamId}
                        boardId={boardId}
                        columnId={displayTask.column_id}
                    />
                </Box>

                {/* Attachments */}
                <Box sx={{ mb: 3 }}>
                    <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>
                        Attachments
                    </Typography>
                    <AttachmentList
                        attachments={detail?.attachments ?? []}
                        teamId={teamId}
                        boardId={boardId}
                        taskId={displayTask.id}
                    />
                </Box>

                {/* GitLab */}
                {gitlabProjects.length > 0 && (
                    <Box sx={{ mb: 3 }}>
                        <GitlabSection
                            task={displayTask}
                            teamId={teamId}
                            boardId={boardId}
                            gitlabProjects={gitlabProjects}
                            onLinkCreated={(link: TaskGitlabLink) => {
                                if (detail) {
                                    setDetail({
                                        ...detail,
                                        gitlab_links: [...(detail.gitlab_links ?? []), link],
                                    });
                                }
                            }}
                            onLinkRemoved={(linkId: string) => {
                                if (detail) {
                                    setDetail({
                                        ...detail,
                                        gitlab_links: (detail.gitlab_links ?? []).filter(
                                            (l) => l.id !== linkId,
                                        ),
                                    });
                                }
                            }}
                        />
                    </Box>
                )}

                <Divider sx={{ mb: 2 }} />

                {/* Activity + Comments */}
                <Box>
                    <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>
                        Activity
                    </Typography>
                    {detail ? (
                        <ActivityFeed
                            comments={detail.comments ?? []}
                            activities={detail.activities ?? []}
                            teamId={teamId}
                            boardId={boardId}
                            taskId={displayTask.id}
                            currentUserId={auth.user.id}
                        />
                    ) : (
                        <Typography variant="body2" color="text.secondary">
                            Loading activity...
                        </Typography>
                    )}
                </Box>
            </Box>
        </Drawer>
    );
}
