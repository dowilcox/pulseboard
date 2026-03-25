import QuickCreateTask from "@/Components/Tasks/QuickCreateTask";
import SortableTaskCard from "@/Components/Tasks/SortableTaskCard";
import TaskCard from "@/Components/Tasks/TaskCard";
import type { Column, PaginatedResponse, Task, TaskTemplate } from "@/types";
import { computeSortOrder } from "@/utils/sortOrder";
import {
    closestCorners,
    DndContext,
    DragOverlay,
    KeyboardSensor,
    PointerSensor,
    useDroppable,
    useSensor,
    useSensors,
} from "@dnd-kit/core";
import type {
    DragEndEvent,
    DragOverEvent,
    DragStartEvent,
} from "@dnd-kit/core";
import {
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useSnackbar } from "@/Contexts/SnackbarContext";
import { router } from "@inertiajs/react";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import IconButton from "@mui/material/IconButton";
import Paper from "@mui/material/Paper";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

function buildColumnTasksMap(columns: Column[]): Record<string, Task[]> {
    const map: Record<string, Task[]> = {};
    for (const col of columns) {
        map[col.id] = [...(col.tasks ?? [])].sort(
            (a, b) => a.sort_order - b.sort_order,
        );
    }
    return map;
}

function findColumnForTask(
    columnTasks: Record<string, Task[]>,
    taskId: string,
): string | null {
    for (const [colId, tasks] of Object.entries(columnTasks)) {
        if (tasks.some((t) => t.id === taskId)) {
            return colId;
        }
    }
    return null;
}

interface DroppableColumnBodyProps {
    columnId: string;
    children: React.ReactNode;
    onScrollBottom?: () => void;
}

function DroppableColumnBody({
    columnId,
    children,
    onScrollBottom,
}: DroppableColumnBodyProps) {
    const { setNodeRef, isOver } = useDroppable({ id: columnId });
    const scrollRef = useRef<HTMLDivElement | null>(null);
    const sentinelRef = useRef<HTMLDivElement | null>(null);

    // Use IntersectionObserver on a sentinel at the bottom
    useEffect(() => {
        const sentinel = sentinelRef.current;
        const scrollContainer = scrollRef.current;
        if (!sentinel || !scrollContainer || !onScrollBottom) return;

        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0]?.isIntersecting) {
                    onScrollBottom();
                }
            },
            {
                root: scrollContainer,
                rootMargin: "100px",
            },
        );

        observer.observe(sentinel);
        return () => observer.disconnect();
    }, [onScrollBottom]);

    return (
        <Box
            ref={(node: HTMLDivElement | null) => {
                setNodeRef(node);
                scrollRef.current = node;
            }}
            sx={{
                px: 1,
                pt: 1,
                pb: 1.5,
                minHeight: 100,
                maxHeight: "calc(100vh - 280px)",
                overflowY: "auto",
                display: "flex",
                flexDirection: "column",
                gap: 1.25,
                borderRadius: "0 0 12px 12px",
                transition: "background-color 150ms ease",
                bgcolor: isOver ? "action.selected" : "transparent",
            }}
        >
            {children}
            {onScrollBottom && (
                <div ref={sentinelRef} style={{ height: 1, flexShrink: 0 }} />
            )}
        </Box>
    );
}

function getCollapsedColumnsKey(boardId: string): string {
    return `pulseboard:collapsed-columns:${boardId}`;
}

function loadCollapsedColumns(boardId: string): Set<string> {
    try {
        const stored = localStorage.getItem(getCollapsedColumnsKey(boardId));
        if (stored) {
            const parsed = JSON.parse(stored);
            if (Array.isArray(parsed)) return new Set(parsed);
        }
    } catch {
        // ignore invalid localStorage data
    }
    return new Set();
}

function saveCollapsedColumns(boardId: string, collapsed: Set<string>): void {
    try {
        localStorage.setItem(
            getCollapsedColumnsKey(boardId),
            JSON.stringify([...collapsed]),
        );
    } catch {
        // ignore localStorage errors
    }
}

interface CollapsedColumnProps {
    column: Column;
    taskCount: number;
    onExpand: () => void;
}

function CollapsedColumn({
    column,
    taskCount,
    onExpand,
}: CollapsedColumnProps) {
    const { setNodeRef, isOver } = useDroppable({ id: column.id });

    return (
        <Paper
            ref={setNodeRef}
            elevation={0}
            sx={{
                width: 48,
                minWidth: 48,
                flex: "0 0 48px",
                bgcolor: isOver ? "action.selected" : "action.hover",
                borderRadius: "12px",
                border: 1,
                borderColor: isOver ? "primary.main" : "divider",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                py: 1.5,
                cursor: "pointer",
                transition: "all 200ms ease",
                minHeight: 200,
                "&:hover": {
                    borderColor: "primary.main",
                    bgcolor: "action.focus",
                },
            }}
            onClick={onExpand}
            onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onExpand();
                }
            }}
            role="button"
            tabIndex={0}
            aria-label={`Expand ${column.name} column`}
        >
            <Tooltip title="Expand column" placement="right">
                <IconButton size="small" sx={{ mb: 1 }}>
                    <ChevronRightIcon fontSize="small" />
                </IconButton>
            </Tooltip>
            <Box
                sx={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    bgcolor: column.color || "#9e9e9e",
                    flexShrink: 0,
                    mb: 1,
                }}
            />
            <Chip
                label={taskCount}
                size="small"
                variant="outlined"
                sx={{ height: 20, fontSize: "0.65rem", minWidth: 24, mb: 1.5 }}
            />
            <Typography
                variant="caption"
                fontWeight={700}
                sx={{
                    writingMode: "vertical-rl",
                    textOrientation: "mixed",
                    transform: "rotate(180deg)",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    maxHeight: "calc(100vh - 360px)",
                    letterSpacing: "0.05em",
                    color: "text.secondary",
                    userSelect: "none",
                }}
            >
                {column.name}
            </Typography>
        </Paper>
    );
}

interface ColumnLoadState {
    page: number;
    hasMore: boolean;
    loading: boolean;
}

interface Props {
    columns: Column[];
    board: { id: string; slug: string };
    team: { id: string; slug: string };
    filterFn: (task: Task) => boolean;
    onTaskClick: (task: Task) => void;
    taskTemplates?: TaskTemplate[];
    initialTasksPerColumn?: number;
}

export default function KanbanView({
    columns,
    board,
    team,
    filterFn,
    onTaskClick,
    taskTemplates = [],
    initialTasksPerColumn = 20,
}: Props) {
    const [activeTask, setActiveTask] = useState<Task | null>(null);
    const [columnTasks, setColumnTasks] = useState<Record<string, Task[]>>(() =>
        buildColumnTasksMap(columns),
    );
    const { showSnackbar } = useSnackbar();
    const [columnLoadStates, setColumnLoadStates] = useState<
        Record<string, ColumnLoadState>
    >({});
    const abortControllers = useRef<Record<string, AbortController>>({});

    // Collapsed columns state, persisted to localStorage per board
    const [collapsedColumns, setCollapsedColumns] = useState<Set<string>>(() =>
        loadCollapsedColumns(board.id),
    );

    const toggleColumnCollapsed = useCallback(
        (columnId: string) => {
            setCollapsedColumns((prev) => {
                const next = new Set(prev);
                if (next.has(columnId)) {
                    next.delete(columnId);
                } else {
                    next.add(columnId);
                }
                saveCollapsedColumns(board.id, next);
                return next;
            });
        },
        [board.id],
    );

    // Initialize column tasks and load states from server data
    useEffect(() => {
        setColumnTasks(buildColumnTasksMap(columns));

        const states: Record<string, ColumnLoadState> = {};
        for (const col of columns) {
            const loadedCount = col.tasks?.length ?? 0;
            const totalCount = col.tasks_count ?? loadedCount;
            states[col.id] = {
                page: 1,
                hasMore: loadedCount < totalCount,
                loading: false,
            };
        }
        setColumnLoadStates(states);
    }, [columns]);

    const columnMap = useMemo(() => {
        const map: Record<string, Column> = {};
        for (const col of columns) {
            map[col.id] = col;
        }
        return map;
    }, [columns]);

    const taskMap = useMemo(() => {
        const map = new Map<string, Task>();
        for (const tasks of Object.values(columnTasks)) {
            for (const task of tasks) {
                map.set(task.id, task);
            }
        }
        return map;
    }, [columnTasks]);

    const isColumnFull = useCallback(
        (columnId: string, extraCount = 0) => {
            const col = columnMap[columnId];
            if (!col?.wip_limit || col.wip_limit <= 0) return false;
            const loadedCount = columnTasks[columnId]?.length ?? 0;
            const taskCount =
                Math.max(col.tasks_count ?? 0, loadedCount) + extraCount;
            return taskCount >= col.wip_limit;
        },
        [columnMap, columnTasks],
    );

    const loadMoreForColumn = useCallback(
        async (columnId: string) => {
            const state = columnLoadStates[columnId];
            if (!state || !state.hasMore || state.loading) return;

            const key = `col-${columnId}`;
            abortControllers.current[key]?.abort();
            const controller = new AbortController();
            abortControllers.current[key] = controller;

            setColumnLoadStates((prev) => ({
                ...prev,
                [columnId]: { ...prev[columnId], loading: true },
            }));

            try {
                const nextPage = state.page + 1;
                const params = new URLSearchParams({
                    column_id: columnId,
                    page: String(nextPage),
                    per_page: String(initialTasksPerColumn),
                    sort: "sort_order",
                    direction: "asc",
                });

                const response = await fetch(
                    `${route("boards.tasks.index", [team.slug, board.slug])}?${params}`,
                    {
                        headers: { Accept: "application/json" },
                        signal: controller.signal,
                    },
                );

                if (!response.ok) throw new Error("Failed to load tasks");

                const data: PaginatedResponse<Task> = await response.json();

                // Append new tasks, deduplicating
                setColumnTasks((prev) => {
                    const existing = prev[columnId] ?? [];
                    const existingIds = new Set(existing.map((t) => t.id));
                    const newTasks = data.data.filter(
                        (t) => !existingIds.has(t.id),
                    );
                    return {
                        ...prev,
                        [columnId]: [...existing, ...newTasks].sort(
                            (a, b) => a.sort_order - b.sort_order,
                        ),
                    };
                });

                setColumnLoadStates((prev) => ({
                    ...prev,
                    [columnId]: {
                        page: nextPage,
                        hasMore: data.current_page < data.last_page,
                        loading: false,
                    },
                }));
            } catch (error) {
                if ((error as Error).name === "AbortError") return;

                showSnackbar("Failed to load more tasks", "error");
                setColumnLoadStates((prev) => ({
                    ...prev,
                    [columnId]: { ...prev[columnId], loading: false },
                }));
            }
        },
        [
            columnLoadStates,
            team.slug,
            board.slug,
            initialTasksPerColumn,
            showSnackbar,
        ],
    );

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: { distance: 5 },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        }),
    );

    const handleDragStart = useCallback(
        (event: DragStartEvent) => {
            const task = taskMap.get(event.active.id as string) ?? null;
            setActiveTask(task);
        },
        [taskMap],
    );

    const handleDragOver = useCallback(
        (event: DragOverEvent) => {
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

            if (isColumnFull(overCol)) return;

            setColumnTasks((prev) => {
                const activeTasks = [...prev[activeCol]];
                const overTasks = [...prev[overCol]];

                const activeIndex = activeTasks.findIndex(
                    (t) => t.id === activeId,
                );
                if (activeIndex === -1) return prev;

                const [movedTask] = activeTasks.splice(activeIndex, 1);

                const overIndex = overTasks.findIndex((t) => t.id === overId);
                const insertIndex =
                    overIndex >= 0 ? overIndex : overTasks.length;

                overTasks.splice(insertIndex, 0, movedTask);

                return {
                    ...prev,
                    [activeCol]: activeTasks,
                    [overCol]: overTasks,
                };
            });
        },
        [columnTasks, isColumnFull],
    );

    const handleDragEnd = useCallback(
        (event: DragEndEvent) => {
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

            const activeTask = finalTasks.find((t) => t.id === activeId);
            const taskSlug = activeTask?.slug ?? activeId;

            router.patch(
                route("tasks.move", [team.slug, board.slug, taskSlug]),
                { column_id: targetCol, sort_order: newSortOrder },
                { preserveScroll: true },
            );
        },
        [columnTasks, team.slug, board.slug],
    );

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
                    display: "flex",
                    gap: 2.5,
                    overflowX: "auto",
                    pb: 2,
                    minHeight: "calc(100vh - 200px)",
                    alignItems: "flex-start",
                }}
            >
                {columns.length === 0 ? (
                    <Box
                        sx={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            justifyContent: "center",
                            width: "100%",
                            py: 8,
                        }}
                    >
                        <Typography
                            variant="h6"
                            color="text.secondary"
                            gutterBottom
                        >
                            No columns configured
                        </Typography>
                        <Typography
                            variant="body2"
                            color="text.secondary"
                            sx={{ mb: 2 }}
                        >
                            Add columns in board settings to start organizing
                            tasks.
                        </Typography>
                        <Chip
                            label="Open Settings"
                            onClick={() =>
                                router.get(
                                    route("teams.boards.settings", [
                                        team.slug,
                                        board.slug,
                                    ]),
                                )
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
                        const totalCount = Math.max(
                            column.tasks_count ?? 0,
                            allColTasks.length,
                        );
                        const atWipLimit =
                            column.wip_limit != null &&
                            column.wip_limit > 0 &&
                            totalCount >= column.wip_limit;
                        const loadState = columnLoadStates[column.id];
                        const hasMore = loadState?.hasMore ?? false;
                        const isLoading = loadState?.loading ?? false;
                        const isCollapsed = collapsedColumns.has(column.id);

                        if (isCollapsed) {
                            return (
                                <CollapsedColumn
                                    key={column.id}
                                    column={column}
                                    taskCount={totalCount}
                                    onExpand={() =>
                                        toggleColumnCollapsed(column.id)
                                    }
                                />
                            );
                        }

                        return (
                            <Paper
                                key={column.id}
                                elevation={0}
                                role="region"
                                aria-label={`${column.name} column, ${totalCount} tasks${atWipLimit ? ", at WIP limit" : ""}`}
                                sx={{
                                    minWidth: 300,
                                    maxWidth: 340,
                                    flex: "0 0 300px",
                                    bgcolor: "action.hover",
                                    borderRadius: "12px",
                                    border: 1,
                                    borderColor: atWipLimit
                                        ? "warning.main"
                                        : "divider",
                                    display: "flex",
                                    flexDirection: "column",
                                    transition:
                                        "flex 200ms ease, min-width 200ms ease",
                                }}
                            >
                                {/* Column header */}
                                <Box
                                    sx={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 1.25,
                                        px: 2,
                                        py: 1.75,
                                    }}
                                >
                                    <Box
                                        sx={{
                                            width: 10,
                                            height: 10,
                                            borderRadius: "50%",
                                            bgcolor: column.color || "#9e9e9e",
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
                                        label={
                                            column.wip_limit != null &&
                                            column.wip_limit > 0
                                                ? `${totalCount} / ${column.wip_limit}`
                                                : totalCount
                                        }
                                        size="small"
                                        variant="outlined"
                                        color={
                                            atWipLimit ? "warning" : "default"
                                        }
                                        sx={{
                                            height: 22,
                                            fontSize: "0.7rem",
                                            minWidth: 28,
                                        }}
                                    />
                                    <Tooltip title="Collapse column">
                                        <IconButton
                                            size="small"
                                            onClick={() =>
                                                toggleColumnCollapsed(column.id)
                                            }
                                            aria-label={`Collapse ${column.name} column`}
                                            sx={{
                                                ml: 0.5,
                                                width: 26,
                                                height: 26,
                                                opacity: 0.6,
                                                "&:hover": { opacity: 1 },
                                            }}
                                        >
                                            <ChevronLeftIcon fontSize="small" />
                                        </IconButton>
                                    </Tooltip>
                                </Box>

                                {/* Column body with sortable tasks */}
                                <SortableContext
                                    items={tasks.map((t) => t.id)}
                                    strategy={verticalListSortingStrategy}
                                >
                                    <DroppableColumnBody
                                        columnId={column.id}
                                        onScrollBottom={
                                            hasMore
                                                ? () =>
                                                      loadMoreForColumn(
                                                          column.id,
                                                      )
                                                : undefined
                                        }
                                    >
                                        {tasks.map((task) => (
                                            <SortableTaskCard
                                                key={task.id}
                                                task={task}
                                                onClick={onTaskClick}
                                            />
                                        ))}

                                        {/* Loading indicator */}
                                        {isLoading && (
                                            <Box
                                                sx={{
                                                    display: "flex",
                                                    justifyContent: "center",
                                                    py: 1,
                                                }}
                                            >
                                                <CircularProgress size={20} />
                                            </Box>
                                        )}

                                        {/* Load more button as fallback */}
                                        {hasMore && !isLoading && (
                                            <Button
                                                size="small"
                                                variant="text"
                                                onClick={() =>
                                                    loadMoreForColumn(column.id)
                                                }
                                                sx={{
                                                    fontSize: "0.7rem",
                                                    textTransform: "none",
                                                    color: "text.secondary",
                                                    alignSelf: "center",
                                                }}
                                            >
                                                Load more ({allColTasks.length}{" "}
                                                of {totalCount})
                                            </Button>
                                        )}

                                        <QuickCreateTask
                                            teamId={team.slug}
                                            boardId={board.slug}
                                            columnId={column.id}
                                            templates={taskTemplates}
                                            disabled={atWipLimit}
                                        />
                                    </DroppableColumnBody>
                                </SortableContext>
                            </Paper>
                        );
                    })
                )}
            </Box>

            {/* Drag overlay */}
            <DragOverlay>
                {activeTask ? (
                    <Box
                        sx={{
                            opacity: 0.9,
                            transform: "rotate(2deg)",
                            filter: "drop-shadow(0 8px 16px rgba(0,0,0,0.15))",
                        }}
                    >
                        <TaskCard task={activeTask} />
                    </Box>
                ) : null}
            </DragOverlay>
        </DndContext>
    );
}
