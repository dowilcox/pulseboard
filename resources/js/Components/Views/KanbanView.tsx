import QuickCreateTask from '@/Components/Tasks/QuickCreateTask';
import SortableTaskCard from '@/Components/Tasks/SortableTaskCard';
import TaskCard from '@/Components/Tasks/TaskCard';
import type { Column, Task } from '@/types';
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
import { router } from '@inertiajs/react';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import { useCallback, useEffect, useMemo, useState } from 'react';

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

interface Props {
    columns: Column[];
    board: { id: string };
    team: { id: string };
    filterFn: (task: Task) => boolean;
    onTaskClick: (task: Task) => void;
}

export default function KanbanView({ columns, board, team, filterFn, onTaskClick }: Props) {
    const [activeTask, setActiveTask] = useState<Task | null>(null);
    const [columnTasks, setColumnTasks] = useState<Record<string, Task[]>>(() =>
        buildColumnTasksMap(columns)
    );

    useEffect(() => {
        setColumnTasks(buildColumnTasksMap(columns));
    }, [columns]);

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
        let overCol = findColumnForTask(columnTasks, overId);
        if (!overCol && columnTasks[overId]) {
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

        if (activeIndex !== overIndex && overIndex >= 0) {
            setColumnTasks((prev) => {
                const newTasks = [...prev[targetCol]];
                const [moved] = newTasks.splice(activeIndex, 1);
                newTasks.splice(overIndex, 0, moved);
                return { ...prev, [targetCol]: newTasks };
            });
        }

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
        sortOrders.splice(finalIndex, 1);
        const newSortOrder = computeSortOrder(sortOrders, finalIndex);

        router.patch(
            route('tasks.move', [team.id, board.id, activeId]),
            { column_id: targetCol, sort_order: newSortOrder },
            { preserveScroll: true }
        );
    }, [columnTasks, team.id, board.id]);

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
        >
            <Box
                role="region"
                aria-label="Kanban board"
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
                        const tasks = allColTasks.filter(filterFn);
                        const taskCount = allColTasks.length;
                        return (
                            <Paper
                                key={column.id}
                                elevation={0}
                                role="region"
                                aria-label={`${column.name} column, ${taskCount} tasks`}
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
                                                onClick={onTaskClick}
                                            />
                                        ))}

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
    );
}
