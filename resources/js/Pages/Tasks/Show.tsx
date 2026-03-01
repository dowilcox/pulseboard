import RichTextEditor from '@/Components/Common/RichTextEditor';
import GitlabSection from '@/Components/Gitlab/GitlabSection';
import ActivityFeed from '@/Components/Tasks/ActivityFeed';
import AssigneeSelector from '@/Components/Tasks/AssigneeSelector';
import AttachmentList from '@/Components/Tasks/AttachmentList';
import ChecklistEditor from '@/Components/Tasks/ChecklistEditor';
import DependencySection from '@/Components/Tasks/DependencySection';
import LabelSelector from '@/Components/Tasks/LabelSelector';
import PrioritySelector from '@/Components/Tasks/PrioritySelector';
import RecurrenceConfig from '@/Components/Tasks/RecurrenceConfig';
import SubtaskList from '@/Components/Tasks/SubtaskList';
import { useBoardChannel, type BoardEvent } from '@/hooks/useBoardChannel';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import type {
    Board,
    Checklist,
    GitlabProject,
    Label,
    PageProps,
    RecurrenceConfig as RecurrenceConfigType,
    Task,
    TaskSummary,
    User,
} from '@/types';
import { Head, Link as InertiaLink, router, usePage } from '@inertiajs/react';
import BookmarkAddIcon from '@mui/icons-material/BookmarkAdd';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import DeleteIcon from '@mui/icons-material/Delete';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import Box from '@mui/material/Box';
import Breadcrumbs from '@mui/material/Breadcrumbs';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import Grid from '@mui/material/Grid2';
import Link from '@mui/material/Link';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { useCallback, useRef, useState } from 'react';

interface Props {
    task: Task;
    team: {
        id: string;
        name: string;
        slug: string;
        members?: User[];
    };
    board: Board;
    members: User[];
    labels: Label[];
    gitlabProjects: GitlabProject[];
    boardTasks: TaskSummary[];
}

export default function TasksShow({
    task,
    team,
    board,
    members,
    labels,
    gitlabProjects,
    boardTasks,
}: Props) {
    const { auth } = usePage<PageProps>().props;
    const columns = board.columns ?? [];

    // Local state for debounced fields
    const [title, setTitle] = useState(task.title);
    const [description, setDescription] = useState(task.description ?? '');
    const [dueDate, setDueDate] = useState(task.due_date ?? '');
    const [effortEstimate, setEffortEstimate] = useState<string>(
        task.effort_estimate != null ? String(task.effort_estimate) : '',
    );
    const [checklists, setChecklists] = useState<Checklist[]>(task.checklists ?? []);
    const [recurrenceConfig, setRecurrenceConfig] = useState<RecurrenceConfigType | null>(
        task.recurrence_config ?? null,
    );
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
    const [templateName, setTemplateName] = useState('');

    const titleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const descTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const checklistTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const effortTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const recurrenceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Real-time: board channel listener
    const handleBoardEvent = useCallback(
        (event: BoardEvent) => {
            const eventTaskId = event.data.task_id;
            if (eventTaskId && eventTaskId !== task.id) return;
            // Reload task data on relevant events
            router.reload();
        },
        [task.id],
    );
    useBoardChannel(board.id, handleBoardEvent);

    // Debounced save helpers
    const saveField = useCallback(
        (data: Record<string, unknown>) => {
            router.put(route('tasks.update', [team.id, board.id, task.id]), data as any, {
                preserveScroll: true,
                preserveState: true,
            });
        },
        [team.id, board.id, task.id],
    );

    const handleTitleChange = (newTitle: string) => {
        setTitle(newTitle);
        if (!newTitle.trim()) return;
        if (titleTimeoutRef.current) clearTimeout(titleTimeoutRef.current);
        titleTimeoutRef.current = setTimeout(() => saveField({ title: newTitle }), 600);
    };

    const handleDescriptionChange = (html: string) => {
        setDescription(html);
        if (descTimeoutRef.current) clearTimeout(descTimeoutRef.current);
        descTimeoutRef.current = setTimeout(() => saveField({ description: html || null }), 800);
    };

    const handleChecklistsChange = (newChecklists: Checklist[]) => {
        setChecklists(newChecklists);
        if (checklistTimeoutRef.current) clearTimeout(checklistTimeoutRef.current);
        checklistTimeoutRef.current = setTimeout(() => saveField({ checklists: newChecklists }), 800);
    };

    const handleDueDateChange = (newDate: string) => {
        setDueDate(newDate);
        saveField({ due_date: newDate || null });
    };

    const handleEffortChange = (value: string) => {
        setEffortEstimate(value);
        if (effortTimeoutRef.current) clearTimeout(effortTimeoutRef.current);
        effortTimeoutRef.current = setTimeout(() => {
            const num = parseInt(value);
            saveField({ effort_estimate: isNaN(num) ? null : num });
        }, 600);
    };

    const handleRecurrenceChange = (config: RecurrenceConfigType | null) => {
        setRecurrenceConfig(config);
        if (recurrenceTimeoutRef.current) clearTimeout(recurrenceTimeoutRef.current);
        recurrenceTimeoutRef.current = setTimeout(() => saveField({ recurrence_config: config }), 600);
    };

    const handleColumnChange = (columnId: string) => {
        router.patch(
            route('tasks.move', [team.id, board.id, task.id]),
            { column_id: columnId, sort_order: 0 },
            { preserveScroll: true },
        );
    };

    const handleToggleComplete = () => {
        router.patch(
            route('tasks.toggle-complete', [team.id, board.id, task.id]),
            {},
            { preserveScroll: true },
        );
    };

    const handleDelete = () => {
        router.delete(route('tasks.destroy', [team.id, board.id, task.id]), {
            onSuccess: () => router.visit(route('teams.boards.show', [team.id, board.id])),
        });
    };

    const handleSaveAsTemplate = () => {
        if (!templateName.trim()) return;
        router.post(
            route('tasks.save-template', [team.id, board.id, task.id]),
            { name: templateName.trim() },
            {
                preserveScroll: true,
                onSuccess: () => {
                    setTemplateDialogOpen(false);
                    setTemplateName('');
                },
            },
        );
    };

    const handleSubtaskClick = (subtask: Task) => {
        router.visit(route('tasks.show', [team.id, board.id, subtask.id]));
    };

    const isCompleted = task.completed_at !== null && task.completed_at !== undefined;
    const taskNumber = task.task_number ? `#${task.task_number}` : '';

    const formatTimestamp = (ts: string) => {
        const date = new Date(ts);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        if (diffMins < 1) return 'just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        const diffHours = Math.floor(diffMins / 60);
        if (diffHours < 24) return `${diffHours}h ago`;
        const diffDays = Math.floor(diffHours / 24);
        if (diffDays < 7) return `${diffDays}d ago`;
        return date.toLocaleDateString();
    };

    return (
        <AuthenticatedLayout
            currentTeam={team as any}
            activeBoardId={board.id}
            header={
                <Breadcrumbs>
                    <Link
                        component={InertiaLink}
                        href={route('teams.show', team.id)}
                        underline="hover"
                        color="text.secondary"
                        variant="body2"
                    >
                        {team.name}
                    </Link>
                    <Link
                        component={InertiaLink}
                        href={route('teams.boards.show', [team.id, board.id])}
                        underline="hover"
                        color="text.secondary"
                        variant="body2"
                    >
                        {board.name}
                    </Link>
                    <Typography variant="body2" color="text.primary">
                        {taskNumber || task.title}
                    </Typography>
                </Breadcrumbs>
            }
        >
            <Head title={`${taskNumber} ${task.title} - ${board.name}`} />

            <Grid container spacing={3}>
                {/* Left column — main content */}
                <Grid size={{ xs: 12, md: 8 }}>
                    {/* Task number + title */}
                    <Box sx={{ mb: 2 }}>
                        {taskNumber && (
                            <Typography variant="caption" color="text.secondary" fontWeight={600}>
                                {taskNumber}
                            </Typography>
                        )}
                        <TextField
                            fullWidth
                            variant="standard"
                            value={title}
                            onChange={(e) => handleTitleChange(e.target.value)}
                            slotProps={{
                                input: {
                                    sx: {
                                        fontSize: '1.5rem',
                                        fontWeight: 600,
                                        textDecoration: isCompleted ? 'line-through' : 'none',
                                    },
                                    disableUnderline: true,
                                },
                            }}
                            aria-label="Task title"
                        />

                        {/* Parent task breadcrumb */}
                        {task.parent_task && (
                            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                                Subtask of{' '}
                                <Link
                                    component={InertiaLink}
                                    href={route('tasks.show', [team.id, board.id, task.parent_task.id])}
                                    underline="hover"
                                >
                                    {task.parent_task.task_number
                                        ? `#${task.parent_task.task_number}`
                                        : ''}{' '}
                                    {task.parent_task.title}
                                </Link>
                            </Typography>
                        )}
                    </Box>

                    <Divider sx={{ mb: 3 }} />

                    {/* Description */}
                    <Box sx={{ mb: 3 }}>
                        <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>
                            Description
                        </Typography>
                        <RichTextEditor
                            content={description}
                            onChange={handleDescriptionChange}
                            placeholder="Add a description..."
                            uploadImageUrl={route('tasks.images.store', [team.id, board.id, task.id])}
                            minHeight={150}
                        />
                    </Box>

                    {/* Checklists */}
                    <Box sx={{ mb: 3 }}>
                        <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>
                            Checklists
                        </Typography>
                        <ChecklistEditor
                            checklists={checklists}
                            onChange={handleChecklistsChange}
                        />
                    </Box>

                    {/* Subtasks */}
                    <Box sx={{ mb: 3 }}>
                        <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>
                            Subtasks
                        </Typography>
                        <SubtaskList
                            task={task}
                            teamId={team.id}
                            boardId={board.id}
                            columnId={task.column_id}
                            onSubtaskClick={handleSubtaskClick}
                        />
                    </Box>

                    {/* Attachments */}
                    <Box sx={{ mb: 3 }}>
                        <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>
                            Attachments
                        </Typography>
                        <AttachmentList
                            attachments={task.attachments ?? []}
                            teamId={team.id}
                            boardId={board.id}
                            taskId={task.id}
                        />
                    </Box>

                    {/* GitLab */}
                    {gitlabProjects.length > 0 && (
                        <Box sx={{ mb: 3 }}>
                            <GitlabSection
                                task={task}
                                teamId={team.id}
                                boardId={board.id}
                                gitlabProjects={gitlabProjects}
                            />
                        </Box>
                    )}

                    <Divider sx={{ mb: 2 }} />

                    {/* Activity + Comments */}
                    <Box>
                        <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>
                            Activity
                        </Typography>
                        <ActivityFeed
                            comments={task.comments ?? []}
                            activities={task.activities ?? []}
                            teamId={team.id}
                            boardId={board.id}
                            taskId={task.id}
                            currentUserId={auth.user.id}
                            uploadImageUrl={route('tasks.images.store', [team.id, board.id, task.id])}
                        />
                    </Box>
                </Grid>

                {/* Right column — sidebar */}
                <Grid size={{ xs: 12, md: 4 }}>
                    <Box
                        sx={{
                            position: 'sticky',
                            top: 80,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 2.5,
                        }}
                    >
                        {/* Complete toggle */}
                        <Button
                            variant={isCompleted ? 'contained' : 'outlined'}
                            color={isCompleted ? 'success' : 'inherit'}
                            startIcon={
                                isCompleted ? <CheckCircleOutlineIcon /> : <RadioButtonUncheckedIcon />
                            }
                            onClick={handleToggleComplete}
                            fullWidth
                            aria-label={isCompleted ? 'Mark incomplete' : 'Mark complete'}
                        >
                            {isCompleted ? 'Completed' : 'Mark Complete'}
                        </Button>

                        {/* Column selector */}
                        <Box>
                            <Typography variant="caption" color="text.secondary" fontWeight={600}>
                                Column
                            </Typography>
                            <Select
                                size="small"
                                fullWidth
                                value={task.column_id}
                                onChange={(e) => handleColumnChange(e.target.value)}
                                renderValue={(value) => {
                                    const col = columns.find((c) => c.id === value);
                                    return (
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                            <Box
                                                sx={{
                                                    width: 10,
                                                    height: 10,
                                                    borderRadius: '50%',
                                                    bgcolor: col?.color ?? 'grey.400',
                                                    flexShrink: 0,
                                                }}
                                            />
                                            {col?.name ?? 'Unknown'}
                                        </Box>
                                    );
                                }}
                            >
                                {columns.map((col) => (
                                    <MenuItem key={col.id} value={col.id}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                            <Box
                                                sx={{
                                                    width: 10,
                                                    height: 10,
                                                    borderRadius: '50%',
                                                    bgcolor: col.color,
                                                    flexShrink: 0,
                                                }}
                                            />
                                            {col.name}
                                        </Box>
                                    </MenuItem>
                                ))}
                            </Select>
                        </Box>

                        {/* Priority */}
                        <Box>
                            <Typography variant="caption" color="text.secondary" fontWeight={600}>
                                Priority
                            </Typography>
                            <PrioritySelector task={task} teamId={team.id} boardId={board.id} />
                        </Box>

                        {/* Assignees */}
                        <Box>
                            <Typography variant="caption" color="text.secondary" fontWeight={600}>
                                Assignees
                            </Typography>
                            <AssigneeSelector
                                task={task}
                                members={members}
                                teamId={team.id}
                                boardId={board.id}
                            />
                        </Box>

                        {/* Labels */}
                        <Box>
                            <Typography variant="caption" color="text.secondary" fontWeight={600}>
                                Labels
                            </Typography>
                            <LabelSelector
                                task={task}
                                labels={labels}
                                teamId={team.id}
                                boardId={board.id}
                            />
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
                                onChange={(e) => handleDueDateChange(e.target.value)}
                                slotProps={{
                                    input: {
                                        startAdornment: (
                                            <CalendarTodayIcon
                                                sx={{ fontSize: 16, mr: 1, color: 'text.secondary' }}
                                            />
                                        ),
                                    },
                                    inputLabel: { shrink: true },
                                }}
                            />
                        </Box>

                        {/* Effort estimate */}
                        <Box>
                            <Typography variant="caption" color="text.secondary" fontWeight={600}>
                                Effort Estimate
                            </Typography>
                            <TextField
                                type="number"
                                size="small"
                                fullWidth
                                value={effortEstimate}
                                onChange={(e) => handleEffortChange(e.target.value)}
                                placeholder="Points"
                                slotProps={{ htmlInput: { min: 0 } }}
                            />
                        </Box>

                        <Divider />

                        {/* Dependencies */}
                        <Box>
                            <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 0.5 }}>
                                Dependencies
                            </Typography>
                            <DependencySection
                                task={task}
                                boardTasks={boardTasks}
                                teamId={team.id}
                                boardId={board.id}
                            />
                        </Box>

                        <Divider />

                        {/* Recurrence */}
                        <Box>
                            <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 0.5 }}>
                                Recurrence
                            </Typography>
                            <RecurrenceConfig
                                config={recurrenceConfig}
                                onChange={handleRecurrenceChange}
                            />
                        </Box>

                        <Divider />

                        {/* Timestamps */}
                        <Box>
                            <Typography variant="caption" color="text.secondary" display="block">
                                Created {formatTimestamp(task.created_at)}
                                {task.creator && ` by ${task.creator.name}`}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" display="block">
                                Updated {formatTimestamp(task.updated_at)}
                            </Typography>
                        </Box>

                        <Divider />

                        {/* Actions */}
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                            <Button
                                variant="outlined"
                                startIcon={<BookmarkAddIcon />}
                                onClick={() => setTemplateDialogOpen(true)}
                                fullWidth
                                size="small"
                            >
                                Save as Template
                            </Button>
                            <Button
                                variant="outlined"
                                color="error"
                                startIcon={<DeleteIcon />}
                                onClick={() => setDeleteDialogOpen(true)}
                                fullWidth
                                size="small"
                            >
                                Delete Task
                            </Button>
                        </Box>
                    </Box>
                </Grid>
            </Grid>

            {/* Delete confirmation dialog */}
            <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
                <DialogTitle>Delete Task</DialogTitle>
                <DialogContent>
                    <Typography>
                        Are you sure you want to delete "{task.title}"? This will also delete all subtasks,
                        comments, and attachments. This action cannot be undone.
                    </Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
                    <Button onClick={handleDelete} color="error" variant="contained">
                        Delete
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Save as template dialog */}
            <Dialog
                open={templateDialogOpen}
                onClose={() => setTemplateDialogOpen(false)}
                maxWidth="xs"
                fullWidth
            >
                <DialogTitle>Save as Template</DialogTitle>
                <DialogContent>
                    <TextField
                        autoFocus
                        fullWidth
                        label="Template name"
                        value={templateName}
                        onChange={(e) => setTemplateName(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveAsTemplate();
                        }}
                        sx={{ mt: 1 }}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setTemplateDialogOpen(false)}>Cancel</Button>
                    <Button
                        onClick={handleSaveAsTemplate}
                        variant="contained"
                        disabled={!templateName.trim()}
                    >
                        Save
                    </Button>
                </DialogActions>
            </Dialog>
        </AuthenticatedLayout>
    );
}
