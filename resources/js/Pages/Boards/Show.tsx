import FilterBar from '@/Components/Tasks/FilterBar';
import PresenceAvatars from '@/Components/Layout/PresenceAvatars';
import QuickCreateTask from '@/Components/Tasks/QuickCreateTask';
import SortableTaskCard from '@/Components/Tasks/SortableTaskCard';
import TaskCard from '@/Components/Tasks/TaskCard';
import TaskDetailPanel from '@/Components/Tasks/TaskDetailPanel';
import { useBoardChannel, type BoardEvent } from '@/hooks/useBoardChannel';
import { usePresence } from '@/hooks/usePresence';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import type { Board, Column, GitlabProject, Label, PageProps, Task, Team, User } from '@/types';
import { computeSortOrder } from '@/utils/sortOrder';
import {
    closestCorners,
    DndContext,
    DragOverlay,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
} from '@dnd-kit/core';
import type { DragEndEvent, DragOverEvent, DragStartEvent } from '@dnd-kit/core';
import {
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { Head, router, usePage } from '@inertiajs/react';
import { Link as InertiaLink } from '@inertiajs/react';
import SettingsIcon from '@mui/icons-material/Settings';
import Box from '@mui/material/Box';
import Breadcrumbs from '@mui/material/Breadcrumbs';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Link from '@mui/material/Link';
import Paper from '@mui/material/Paper';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

interface Props {
    board: Board;
    team: Team;
    teams: Team[];
    boards: Board[];
    members: User[];
    gitlabProjects?: GitlabProject[];
}

// Build a map of columnId -> tasks[] for DnD state management
function buildColumnTasksMap(columns: Column[]): Record<string, Task[]> {
    const map: Record<string, Task[]> = {};
    for (const col of columns) {
        map[col.id] = [...(col.tasks ?? [])].sort((a, b) => a.sort_order - b.sort_order);
    }
    return map;
}

function findColumnForTask(columnTasks: Record<string, Task[]>, taskId: string): string | null {
    for (const [colId, tasks] of Object.entries(columnTasks)) {
        if (tasks.some((t) => t.id === taskId)) {
            return colId;
        }
    }
    return null;
}

export default function BoardsShow({ board, team, teams, boards, members, gitlabProjects = [] }: Props) {
    const { auth } = usePage<PageProps>().props;
    const columns = board.columns ?? [];
    const [selectedTask, setSelectedTask] = useState<Task | null>(null);
    const [panelOpen, setPanelOpen] = useState(false);
    const [teamLabels, setTeamLabels] = useState<Label[]>([]);
    const [activeTask, setActiveTask] = useState<Task | null>(null);
    const [columnTasks, setColumnTasks] = useState<Record<string, Task[]>>(() =>
        buildColumnTasksMap(columns)
    );
    const [taskFilter, setTaskFilter] = useState<(task: Task) => boolean>(() => () => true);
    const [lastBoardEvent, setLastBoardEvent] = useState<BoardEvent | null>(null);

    // Sync columnTasks when server data changes (after Inertia reload)
    useEffect(() => {
        setColumnTasks(buildColumnTasksMap(columns));
    }, [board]);

    // Real-time: presence
    const presenceUsers = usePresence(board.id);

    // Real-time: board channel listener
    const selectedTaskRef = useRef(selectedTask);
    selectedTaskRef.current = selectedTask;
    const panelOpenRef = useRef(panelOpen);
    panelOpenRef.current = panelOpen;

    const handleBoardEvent = useCallback((event: BoardEvent) => {
        setLastBoardEvent(event);

        switch (event.action) {
            case 'created':
            case 'task.deleted':
                // Full reload for structural changes
                router.reload();
                break;

            case 'moved':
            case 'task.reordered':
                // Reload to get fresh column/task state
                router.reload();
                break;

            case 'field_changed':
            case 'assigned':
            case 'unassigned':
            case 'labels_changed':
                // Update the task in local state if possible, otherwise reload
                if (event.data.task_id) {
                    router.reload();
                }
                break;

            case 'commented':
            case 'comment.updated':
            case 'comment.deleted':
            case 'attachment_added':
            case 'attachment_removed':
                // These don't affect the board view, only the detail panel
                // lastBoardEvent will trigger a re-fetch in TaskDetailPanel
                break;

            case 'gitlab_branch_created':
            case 'gitlab_mr_created':
            case 'gitlab_mr_merged':
            case 'gitlab_mr_closed':
                // Reload to show updated gitlab badges on task cards
                router.reload();
                break;

            default:
                router.reload();
                break;
        }
    }, []);

    useBoardChannel(board.id, handleBoardEvent);

    useEffect(() => {
        fetch(route('labels.index', team.id), {
            headers: { Accept: 'application/json' },
        })
            .then((res) => res.json())
            .then((data: Label[]) => setTeamLabels(data))
            .catch(() => {});
    }, [team.id]);

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: { distance: 5 },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const handleDragStart = useCallback((event: DragStartEvent) => {
        const { active } = event;
        // Find the task being dragged
        for (const tasks of Object.values(columnTasks)) {
            const task = tasks.find((t) => t.id === active.id);
            if (task) {
                setActiveTask(task);
                break;
            }
        }
    }, [columnTasks]);

    const handleDragOver = useCallback((event: DragOverEvent) => {
        const { active, over } = event;
        if (!over) return;

        const activeId = active.id as string;
        const overId = over.id as string;

        const activeCol = findColumnForTask(columnTasks, activeId);
        // overId might be a task or a column
        let overCol = findColumnForTask(columnTasks, overId);
        if (!overCol && columnTasks[overId]) {
            // Dropped over a column container directly
            overCol = overId;
        }

        if (!activeCol || !overCol || activeCol === overCol) return;

        setColumnTasks((prev) => {
            const activeTasks = [...prev[activeCol]];
            const overTasks = [...prev[overCol]];

            const activeIndex = activeTasks.findIndex((t) => t.id === activeId);
            if (activeIndex === -1) return prev;

            const [movedTask] = activeTasks.splice(activeIndex, 1);

            const overIndex = overTasks.findIndex((t) => t.id === overId);
            const insertIndex = overIndex >= 0 ? overIndex : overTasks.length;

            overTasks.splice(insertIndex, 0, movedTask);

            return {
                ...prev,
                [activeCol]: activeTasks,
                [overCol]: overTasks,
            };
        });
    }, [columnTasks]);

    const handleDragEnd = useCallback((event: DragEndEvent) => {
        const { active, over } = event;
        setActiveTask(null);

        if (!over) return;

        const activeId = active.id as string;
        const overId = over.id as string;

        const targetCol = findColumnForTask(columnTasks, activeId);
        if (!targetCol) return;

        const tasks = columnTasks[targetCol];
        const activeIndex = tasks.findIndex((t) => t.id === activeId);
        const overIndex = tasks.findIndex((t) => t.id === overId);

        // Reorder within column if needed
        if (activeIndex !== overIndex && overIndex >= 0) {
            setColumnTasks((prev) => {
                const newTasks = [...prev[targetCol]];
                const [moved] = newTasks.splice(activeIndex, 1);
                newTasks.splice(overIndex, 0, moved);
                return { ...prev, [targetCol]: newTasks };
            });
        }

        // Compute the new sort_order
        const finalTasks = (() => {
            const t = [...tasks];
            if (activeIndex !== overIndex && overIndex >= 0) {
                const [moved] = t.splice(activeIndex, 1);
                t.splice(overIndex, 0, moved);
            }
            return t;
        })();

        const finalIndex = finalTasks.findIndex((t) => t.id === activeId);
        const sortOrders = finalTasks.map((t) => t.sort_order);
        // Remove the active item's sort_order to compute new one
        sortOrders.splice(finalIndex, 1);
        const newSortOrder = computeSortOrder(sortOrders, finalIndex);

        router.patch(
            route('tasks.move', [team.id, board.id, activeId]),
            { column_id: targetCol, sort_order: newSortOrder },
            { preserveScroll: true }
        );
    }, [columnTasks, team.id, board.id]);

    const handleTaskClick = (task: Task) => {
        setSelectedTask(task);
        setPanelOpen(true);
    };

    const handlePanelClose = () => {
        setPanelOpen(false);
        setSelectedTask(null);
    };

    // Collect all task IDs for the drag overlay lookup
    const allTasks = useMemo(() => {
        const tasks: Task[] = [];
        for (const t of Object.values(columnTasks)) {
            tasks.push(...t);
        }
        return tasks;
    }, [columnTasks]);

    return (
        <AuthenticatedLayout
            teams={teams}
            currentTeam={team}
            boards={boards}
            activeBoardId={board.id}
            header={
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                    <Box>
                        <Breadcrumbs sx={{ mb: 0.5 }}>
                            <Link
                                component={InertiaLink}
                                href={route('teams.index')}
                                underline="hover"
                                color="text.secondary"
                                variant="body2"
                            >
                                Teams
                            </Link>
                            <Link
                                component={InertiaLink}
                                href={route('teams.show', team.id)}
                                underline="hover"
                                color="text.secondary"
                                variant="body2"
                            >
                                {team.name}
                            </Link>
                            <Typography variant="body2" color="text.primary">
                                {board.name}
                            </Typography>
                        </Breadcrumbs>
                        <Typography variant="h6" component="h2" fontWeight={600}>
                            {board.name}
                        </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <PresenceAvatars users={presenceUsers} currentUserId={auth.user.id} />
                        <Tooltip title="Board Settings">
                            <IconButton
                                onClick={() =>
                                    router.get(route('teams.boards.settings', [team.id, board.id]))
                                }
                            >
                                <SettingsIcon />
                            </IconButton>
                        </Tooltip>
                    </Box>
                </Box>
            }
        >
            <Head title={`${board.name} - ${team.name}`} />

            {/* Filter bar */}
            {columns.length > 0 && (
                <FilterBar
                    members={members}
                    labels={teamLabels}
                    onFilterChange={(fn) => setTaskFilter(() => fn)}
                />
            )}

            <DndContext
                sensors={sensors}
                collisionDetection={closestCorners}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDragEnd={handleDragEnd}
            >
                {/* Kanban columns */}
                <Box
                    sx={{
                        display: 'flex',
                        gap: 2,
                        overflowX: 'auto',
                        pb: 2,
                        minHeight: 'calc(100vh - 200px)',
                        alignItems: 'flex-start',
                    }}
                >
                    {columns.length === 0 ? (
                        <Box
                            sx={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                width: '100%',
                                py: 8,
                            }}
                        >
                            <Typography variant="h6" color="text.secondary" gutterBottom>
                                No columns configured
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                Add columns in board settings to start organizing tasks.
                            </Typography>
                            <Chip
                                label="Open Settings"
                                onClick={() =>
                                    router.get(route('teams.boards.settings', [team.id, board.id]))
                                }
                                clickable
                                color="primary"
                                variant="outlined"
                            />
                        </Box>
                    ) : (
                        columns.map((column) => {
                            const allColTasks = columnTasks[column.id] ?? [];
                            const tasks = allColTasks.filter(taskFilter);
                            const taskCount = allColTasks.length;
                            return (
                                <Paper
                                    key={column.id}
                                    elevation={0}
                                    sx={{
                                        minWidth: 280,
                                        maxWidth: 320,
                                        flex: '0 0 280px',
                                        bgcolor: 'action.hover',
                                        borderRadius: 2,
                                        display: 'flex',
                                        flexDirection: 'column',
                                    }}
                                >
                                    {/* Column header */}
                                    <Box
                                        sx={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 1,
                                            p: 2,
                                            pb: 1.5,
                                        }}
                                    >
                                        <Box
                                            sx={{
                                                width: 12,
                                                height: 12,
                                                borderRadius: '50%',
                                                bgcolor: column.color || '#9e9e9e',
                                                flexShrink: 0,
                                            }}
                                        />
                                        <Typography
                                            variant="subtitle2"
                                            fontWeight={700}
                                            sx={{ flex: 1 }}
                                            noWrap
                                        >
                                            {column.name}
                                        </Typography>
                                        <Chip
                                            label={taskCount}
                                            size="small"
                                            variant="outlined"
                                            sx={{ height: 20, fontSize: '0.65rem', minWidth: 28 }}
                                        />
                                        {column.wip_limit != null && column.wip_limit > 0 && (
                                            <Chip
                                                label={`WIP: ${column.wip_limit}`}
                                                size="small"
                                                variant="outlined"
                                                sx={{ height: 20, fontSize: '0.65rem' }}
                                            />
                                        )}
                                    </Box>

                                    {/* Column body with sortable tasks */}
                                    <SortableContext
                                        items={tasks.map((t) => t.id)}
                                        strategy={verticalListSortingStrategy}
                                    >
                                        <Box
                                            sx={{
                                                p: 1.5,
                                                pt: 0.5,
                                                minHeight: 200,
                                                display: 'flex',
                                                flexDirection: 'column',
                                                gap: 1,
                                            }}
                                        >
                                            {tasks.map((task) => (
                                                <SortableTaskCard
                                                    key={task.id}
                                                    task={task}
                                                    onClick={handleTaskClick}
                                                />
                                            ))}

                                            {/* Quick create form */}
                                            <QuickCreateTask
                                                teamId={team.id}
                                                boardId={board.id}
                                                columnId={column.id}
                                            />
                                        </Box>
                                    </SortableContext>
                                </Paper>
                            );
                        })
                    )}
                </Box>

                {/* Drag overlay */}
                <DragOverlay>
                    {activeTask ? (
                        <Box sx={{ opacity: 0.85, transform: 'rotate(2deg)' }}>
                            <TaskCard task={activeTask} />
                        </Box>
                    ) : null}
                </DragOverlay>
            </DndContext>

            {/* Task detail panel */}
            <TaskDetailPanel
                task={selectedTask}
                open={panelOpen}
                onClose={handlePanelClose}
                teamId={team.id}
                boardId={board.id}
                members={members}
                labels={teamLabels}
                gitlabProjects={gitlabProjects}
                lastBoardEvent={lastBoardEvent}
            />
        </AuthenticatedLayout>
    );
}
