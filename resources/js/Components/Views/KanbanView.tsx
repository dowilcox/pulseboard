import axios from "axios";
import QuickCreateTask, {
    wipLimitMessage,
} from "@/Components/Tasks/QuickCreateTask";
import SortableTaskCard from "@/Components/Tasks/SortableTaskCard";
import TaskCard from "@/Components/Tasks/TaskCard";
import type { Column, PaginatedResponse, Task, TaskTemplate } from "@/types";
import { columnCountSummary, type WipStatus } from "@/utils/boardFilters";
import { getTaskLabel } from "@/utils/gitlabPrefix";
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
    Announcements,
    DragEndEvent,
    DragOverEvent,
    DragStartEvent,
    UniqueIdentifier,
} from "@dnd-kit/core";
import {
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useSnackbar } from "@/Contexts/SnackbarContext";
import { harbor, harborHex } from "@/theme/harbor";
import { router } from "@inertiajs/react";
import RouterLink from "@/Components/Common/RouterLink";
import AddIcon from "@mui/icons-material/Add";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import IconButton from "@mui/material/IconButton";
import Paper from "@mui/material/Paper";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/**
 * Columns share the strip's free width. The minimum keeps 3 full columns at
 * 1280px and 4 at 1440px before the strip scrolls; the maximum stops one or
 * two columns on a wide screen from stretching cards past a readable width.
 */
const COLUMN_WIDTH = 264;
const COLUMN_MAX_WIDTH = 560;
const COLUMN_GAP = 12;

function buildColumnTasksMap(columns: Column[]): Record<string, Task[]> {
    const map: Record<string, Task[]> = {};
    for (const col of columns) {
        map[col.id] = [...(col.tasks ?? [])].sort(
            (a, b) => a.sort_order - b.sort_order,
        );
    }
    return map;
}

function groupTasksByColumn(
    columns: Column[],
    tasks: Task[],
): Record<string, Task[]> {
    const map: Record<string, Task[]> = {};
    for (const col of columns) map[col.id] = [];
    for (const task of tasks) map[task.column_id]?.push(task);
    for (const list of Object.values(map)) {
        list.sort((a, b) => a.sort_order - b.sort_order);
    }
    return map;
}

// Indigo accent (harborHex.accent) at low alpha for drop-target highlights
const KANBAN_DROP_HIGHLIGHT = "rgba(57, 89, 166, 0.12)";

const WIP_PILL_COLORS: Record<WipStatus, { fg: string; bg: string }> = {
    under: { fg: harbor.sub, bg: harbor.countBg },
    at: harbor.dueSoon,
    over: harbor.tints.red,
};

/** Column status dot: user-defined color, else a sensible Harbor default. */
function columnDotColor(column: Column): string {
    if (column.color) return column.color;
    if (column.is_done_column) return harbor.colDots.done;
    const name = column.name.toLowerCase();
    if (name.includes("progress") || name.includes("doing")) {
        return harbor.colDots.progress;
    }
    if (name.includes("done") || name.includes("complete")) {
        return harbor.colDots.done;
    }
    if (name.includes("todo") || name.includes("to do")) {
        return harbor.colDots.todo;
    }
    return harbor.colDots.backlog;
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

const PILL_SX = {
    fontSize: "11.5px",
    fontWeight: 700,
    fontVariantNumeric: "tabular-nums",
    borderRadius: "999px",
    padding: "2px 8px",
    whiteSpace: "nowrap",
    flexShrink: 0,
    lineHeight: 1.5,
} as const;

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
            // Lets Inertia restore the column's scroll position on Back
            scroll-region=""
            sx={{
                // Negative margin + padding keeps card shadows unclipped
                // while content stays aligned with the well's 12px inset
                mx: "-4px",
                px: "4px",
                pt: "2px",
                pb: "6px",
                minHeight: 100,
                // Fill the viewport below the header + filter bar so the
                // board needs no page scroll on desktop
                maxHeight: {
                    xs: "calc(100dvh - 220px)",
                    md: "calc(100dvh - 232px)",
                },
                overflowY: "auto",
                display: "flex",
                flexDirection: "column",
                gap: "10px",
                borderRadius: "0 0 12px 12px",
                transition: "background-color 150ms ease-out",
                bgcolor: isOver ? KANBAN_DROP_HIGHLIGHT : "transparent",
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
    countText: string;
    ariaLabel: string;
    onExpand: () => void;
}

function CollapsedColumn({
    column,
    countText,
    ariaLabel,
    onExpand,
}: CollapsedColumnProps) {
    const { setNodeRef, isOver } = useDroppable({ id: column.id });

    return (
        <Paper
            ref={setNodeRef}
            elevation={0}
            component="button"
            type="button"
            onClick={onExpand}
            aria-label={`Expand ${ariaLabel}`}
            sx={{
                width: 52,
                minWidth: 52,
                flex: "0 0 52px",
                bgcolor: isOver ? KANBAN_DROP_HIGHLIGHT : harbor.well,
                borderRadius: "18px",
                border: 0,
                font: "inherit",
                color: harbor.ink,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 1.25,
                py: 1.75,
                cursor: "pointer",
                transition: "background-color 150ms ease-out",
                minHeight: 200,
                "&:hover": {
                    bgcolor: KANBAN_DROP_HIGHLIGHT,
                },
            }}
        >
            <ChevronRightIcon
                fontSize="small"
                aria-hidden
                sx={{ color: harbor.sub }}
            />
            <Box
                component="span"
                sx={{
                    display: "block",
                    width: 9,
                    height: 9,
                    borderRadius: "50%",
                    bgcolor: columnDotColor(column),
                    flexShrink: 0,
                }}
            />
            <Typography
                variant="caption"
                component="span"
                sx={{
                    writingMode: "vertical-rl",
                    textOrientation: "mixed",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    maxHeight: "calc(100vh - 360px)",
                    fontFamily: harbor.headingFont,
                    fontSize: "13px",
                    fontWeight: 700,
                    fontVariantNumeric: "tabular-nums",
                    color: harbor.sub,
                    userSelect: "none",
                }}
            >
                {column.name} · {countText}
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
    /** Filters are hiding tasks: counts read "visible of total". */
    filtersActive?: boolean;
    /**
     * Every task on the board, when loaded and current. While filtering the
     * board loads them all so no matching card hides on an unloaded page.
     */
    allTasks?: Task[] | null;
    taskTemplates?: TaskTemplate[];
    initialTasksPerColumn?: number;
    canManage?: boolean;
}

export default function KanbanView({
    columns,
    board,
    team,
    filterFn,
    filtersActive = false,
    allTasks = null,
    taskTemplates = [],
    initialTasksPerColumn = 20,
    canManage = false,
}: Props) {
    const [activeTask, setActiveTask] = useState<Task | null>(null);
    const [columnTasks, setColumnTasks] = useState<Record<string, Task[]>>(() =>
        buildColumnTasksMap(columns),
    );
    const { showSnackbar } = useSnackbar();
    const [columnLoadStates, setColumnLoadStates] = useState<
        Record<string, ColumnLoadState>
    >({});
    const [topCreateColumnId, setTopCreateColumnId] = useState<string | null>(
        null,
    );
    const abortControllers = useRef<Record<string, AbortController>>({});
    // Column state at drag start, restored if the drag is cancelled
    const dragSnapshotRef = useRef<Record<string, Task[]> | null>(null);
    // A pointer drag ends with a click on the card; don't follow its link
    const suppressClickUntilRef = useRef(0);
    const isClickSuppressed = useCallback(
        () => Date.now() < suppressClickUntilRef.current,
        [],
    );

    // Abort all in-flight "load more" requests on unmount
    useEffect(() => {
        const controllers = abortControllers.current;
        return () => {
            for (const controller of Object.values(controllers)) {
                controller.abort();
            }
        };
    }, []);

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

    // Once every task is loaded (filtered board), show complete columns
    useEffect(() => {
        if (!allTasks) return;
        const grouped = groupTasksByColumn(columns, allTasks);
        setColumnTasks(grouped);
        const states: Record<string, ColumnLoadState> = {};
        for (const col of columns) {
            states[col.id] = { page: 1, hasMore: false, loading: false };
        }
        setColumnLoadStates(states);
        // `columns` is read for grouping only; `allTasks` changes whenever a
        // fresh snapshot for the current board arrives.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [allTasks]);

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

                const { data } = await axios.get<PaginatedResponse<Task>>(
                    route("boards.tasks.index", [team.slug, board.slug]),
                    {
                        params: Object.fromEntries(params),
                        signal: controller.signal,
                    },
                );

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
                if (axios.isCancel(error)) return;

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
            // Enter follows the card's link; Space picks the card up.
            keyboardCodes: {
                start: ["Space"],
                cancel: ["Escape"],
                end: ["Space", "Enter"],
            },
        }),
    );

    const handleDragStart = useCallback(
        (event: DragStartEvent) => {
            suppressClickUntilRef.current = Number.POSITIVE_INFINITY;
            dragSnapshotRef.current = columnTasks;
            const task = taskMap.get(event.active.id as string) ?? null;
            setActiveTask(task);
        },
        [taskMap, columnTasks],
    );

    const endDrag = () => {
        suppressClickUntilRef.current = Date.now() + 300;
        setActiveTask(null);
    };

    const restoreSnapshot = () => {
        if (dragSnapshotRef.current) {
            setColumnTasks(dragSnapshotRef.current);
        }
        dragSnapshotRef.current = null;
    };

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
            endDrag();

            if (!over) {
                restoreSnapshot();
                return;
            }
            dragSnapshotRef.current = null;

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

            const movedTask = finalTasks.find((t) => t.id === activeId);
            const taskSlug = movedTask?.slug ?? activeId;

            router.patch(
                route("tasks.move", [team.slug, board.slug, taskSlug]),
                { column_id: targetCol, sort_order: newSortOrder },
                { preserveScroll: true },
            );
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [columnTasks, team.slug, board.slug],
    );

    const handleDragCancel = useCallback(() => {
        endDrag();
        restoreSnapshot();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Screen-reader announcements by task and column name, not by UUID
    const announcements = useMemo<Announcements>(() => {
        const taskName = (id: UniqueIdentifier) => {
            const task = taskMap.get(String(id));
            return task ? getTaskLabel(task) : "Task";
        };
        const placeName = (id: UniqueIdentifier) => {
            const key = String(id);
            if (columnMap[key]) return `column ${columnMap[key].name}`;
            const colId = findColumnForTask(columnTasks, key);
            const task = taskMap.get(key);
            const colName = colId ? columnMap[colId]?.name : undefined;
            return task
                ? `${getTaskLabel(task)}${colName ? ` in ${colName}` : ""}`
                : "another task";
        };
        return {
            onDragStart: ({ active }) => `Picked up ${taskName(active.id)}.`,
            onDragOver: ({ active, over }) =>
                over
                    ? `${taskName(active.id)} is over ${placeName(over.id)}.`
                    : `${taskName(active.id)} is no longer over a column.`,
            onDragEnd: ({ active, over }) =>
                over
                    ? `${taskName(active.id)} was dropped at ${placeName(over.id)}.`
                    : `${taskName(active.id)} was dropped. Nothing moved.`,
            onDragCancel: ({ active }) =>
                `Moving ${taskName(active.id)} was cancelled.`,
        };
    }, [taskMap, columnMap, columnTasks]);

    // ── Horizontal scroll affordance ────────────────────────────────────
    const stripRef = useRef<HTMLDivElement | null>(null);
    const [edges, setEdges] = useState({ left: false, right: false });
    const updateEdges = useCallback(() => {
        const el = stripRef.current;
        if (!el) return;
        const left = el.scrollLeft > 4;
        const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 4;
        setEdges((prev) =>
            prev.left === left && prev.right === right ? prev : { left, right },
        );
    }, []);

    useEffect(() => {
        updateEdges();
        const el = stripRef.current;
        if (!el || typeof ResizeObserver === "undefined") return;
        const observer = new ResizeObserver(updateEdges);
        observer.observe(el);
        return () => observer.disconnect();
    }, [updateEdges, columns.length, collapsedColumns]);

    const scrollStrip = (direction: 1 | -1) => {
        stripRef.current?.scrollBy({
            left: direction * (COLUMN_WIDTH + COLUMN_GAP) * 2,
            behavior: "smooth",
        });
    };

    const taskHref = useCallback(
        (task: Task) =>
            route("tasks.show", [team.slug, board.slug, task.slug ?? task.id]),
        [team.slug, board.slug],
    );

    if (columns.length === 0) {
        return (
            <Box
                sx={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    width: "100%",
                    py: 8,
                    textAlign: "center",
                }}
            >
                <Typography
                    variant="h6"
                    component="h2"
                    color="text.secondary"
                    gutterBottom
                >
                    No columns yet
                </Typography>
                <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ mb: 2 }}
                >
                    {canManage
                        ? "Add columns in board settings to start organizing tasks."
                        : "Ask a team owner or admin to add columns to this board."}
                </Typography>
                {canManage && (
                    <Button
                        component={RouterLink}
                        href={route("teams.boards.settings", [
                            team.slug,
                            board.slug,
                        ])}
                        variant="outlined"
                    >
                        Open board settings
                    </Button>
                )}
            </Box>
        );
    }

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
            onDragCancel={handleDragCancel}
            accessibility={{
                announcements,
                screenReaderInstructions: {
                    draggable:
                        "Press Enter to open the task. To move it, press Space to pick it up, use the arrow keys to move it, then press Space to drop it or Escape to cancel.",
                },
            }}
        >
            {/* Bleeds into the page's side padding so columns scroll right to
                the edge; the first column still lines up with the header */}
            <Box
                sx={{
                    position: "relative",
                    mx: { xs: -2, lg: -4 },
                    minWidth: 0,
                }}
            >
                <Box
                    ref={stripRef}
                    role="region"
                    aria-label="Kanban board columns"
                    scroll-region=""
                    onScroll={updateEdges}
                    sx={{
                        display: "flex",
                        gap: `${COLUMN_GAP}px`,
                        overflowX: "auto",
                        overflowY: "hidden",
                        px: { xs: 2, lg: 4 },
                        pb: 1,
                        alignItems: "flex-start",
                        overscrollBehaviorX: "contain",
                        scrollPaddingInline: { xs: "16px", lg: "32px" },
                        scrollbarWidth: "thin",
                        scrollbarColor: `${harborHex.faint} transparent`,
                    }}
                >
                    {columns.map((column) => {
                        const allColTasks = columnTasks[column.id] ?? [];
                        const tasks = filtersActive
                            ? allColTasks.filter(filterFn)
                            : allColTasks;
                        const totalCount = Math.max(
                            column.tasks_count ?? 0,
                            allColTasks.length,
                        );
                        const summary = columnCountSummary({
                            name: column.name,
                            visible: tasks.length,
                            total: totalCount,
                            wipLimit: column.wip_limit,
                            filtered: filtersActive,
                        });
                        const atWipLimit =
                            summary.wipStatus === "at" ||
                            summary.wipStatus === "over";
                        const loadState = columnLoadStates[column.id];
                        const hasMore = loadState?.hasMore ?? false;
                        const isLoading = loadState?.loading ?? false;
                        const isCollapsed = collapsedColumns.has(column.id);

                        if (isCollapsed) {
                            return (
                                <CollapsedColumn
                                    key={column.id}
                                    column={column}
                                    countText={
                                        summary.countText ??
                                        summary.wipText ??
                                        String(totalCount)
                                    }
                                    ariaLabel={summary.ariaLabel}
                                    onExpand={() =>
                                        toggleColumnCollapsed(column.id)
                                    }
                                />
                            );
                        }

                        const wipColors = summary.wipStatus
                            ? WIP_PILL_COLORS[summary.wipStatus]
                            : null;

                        return (
                            <Paper
                                key={column.id}
                                elevation={0}
                                role="region"
                                aria-label={summary.ariaLabel}
                                sx={{
                                    flex: `1 1 ${COLUMN_WIDTH}px`,
                                    minWidth: COLUMN_WIDTH,
                                    maxWidth: COLUMN_MAX_WIDTH,
                                    bgcolor: harbor.well,
                                    borderRadius: "18px",
                                    p: "12px",
                                    color: harbor.ink,
                                    display: "flex",
                                    flexDirection: "column",
                                }}
                            >
                                {/* Column header: the name gets the full row
                                    width (beside its actions); counts sit on
                                    their own line so they never squeeze it. */}
                                <Box sx={{ pl: "6px", pt: "2px", pb: "8px" }}>
                                    <Box
                                        sx={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 0.75,
                                            minWidth: 0,
                                        }}
                                    >
                                        <Box
                                            sx={{
                                                width: 9,
                                                height: 9,
                                                borderRadius: "50%",
                                                bgcolor: columnDotColor(column),
                                                flexShrink: 0,
                                            }}
                                        />
                                        <Typography
                                            variant="subtitle2"
                                            component="h2"
                                            title={column.name}
                                            sx={{
                                                color: harbor.ink,
                                                fontFamily: harbor.headingFont,
                                                fontSize: "15px",
                                                fontWeight: 700,
                                                minWidth: 0,
                                                flex: 1,
                                            }}
                                            noWrap
                                        >
                                            {column.name}
                                        </Typography>
                                        <Tooltip
                                            title={
                                                atWipLimit
                                                    ? wipLimitMessage(
                                                          totalCount,
                                                          column.wip_limit,
                                                      )
                                                    : `Add task to ${column.name}`
                                            }
                                        >
                                            <IconButton
                                                size="small"
                                                aria-label={`Add task to ${column.name}`}
                                                aria-disabled={
                                                    atWipLimit || undefined
                                                }
                                                onClick={() => {
                                                    if (atWipLimit) return;
                                                    setTopCreateColumnId(
                                                        column.id,
                                                    );
                                                }}
                                                sx={{
                                                    width: 28,
                                                    height: 28,
                                                    color: harbor.sub,
                                                    "&:hover": {
                                                        color: harbor.ink,
                                                    },
                                                    ...(atWipLimit && {
                                                        cursor: "not-allowed",
                                                        opacity: 0.6,
                                                    }),
                                                }}
                                            >
                                                <AddIcon fontSize="small" />
                                            </IconButton>
                                        </Tooltip>
                                        <Tooltip title="Collapse column">
                                            <IconButton
                                                size="small"
                                                onClick={() =>
                                                    toggleColumnCollapsed(
                                                        column.id,
                                                    )
                                                }
                                                aria-label={`Collapse ${column.name} column`}
                                                sx={{
                                                    width: 28,
                                                    height: 28,
                                                    color: harbor.sub,
                                                    "&:hover": {
                                                        color: harbor.ink,
                                                    },
                                                }}
                                            >
                                                <ChevronLeftIcon fontSize="small" />
                                            </IconButton>
                                        </Tooltip>
                                    </Box>
                                    {(summary.countText ||
                                        (summary.wipText && wipColors)) && (
                                        <Box
                                            sx={{
                                                display: "flex",
                                                flexWrap: "wrap",
                                                alignItems: "center",
                                                gap: 0.75,
                                                pl: "15px",
                                                mt: 0.25,
                                            }}
                                        >
                                            {summary.countText && (
                                                <Box
                                                    component="span"
                                                    sx={{
                                                        ...PILL_SX,
                                                        color: filtersActive
                                                            ? harbor.tints
                                                                  .indigo.fg
                                                            : harbor.sub,
                                                        bgcolor: filtersActive
                                                            ? harbor.tints
                                                                  .indigo.bg
                                                            : harbor.countBg,
                                                    }}
                                                >
                                                    {summary.countText}
                                                </Box>
                                            )}
                                            {summary.wipText && wipColors && (
                                                <Tooltip
                                                    title={`WIP limit: ${column.wip_limit} tasks`}
                                                >
                                                    <Box
                                                        component="span"
                                                        sx={{
                                                            ...PILL_SX,
                                                            color: wipColors.fg,
                                                            bgcolor:
                                                                wipColors.bg,
                                                        }}
                                                    >
                                                        {summary.wipText}
                                                    </Box>
                                                </Tooltip>
                                            )}
                                        </Box>
                                    )}
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
                                        {topCreateColumnId === column.id && (
                                            <QuickCreateTask
                                                teamSlug={team.slug}
                                                boardSlug={board.slug}
                                                columnId={column.id}
                                                columnName={column.name}
                                                formOnly
                                                onClose={() =>
                                                    setTopCreateColumnId(null)
                                                }
                                            />
                                        )}

                                        {tasks.map((task) => (
                                            <SortableTaskCard
                                                key={task.id}
                                                task={task}
                                                href={taskHref(task)}
                                                isClickSuppressed={
                                                    isClickSuppressed
                                                }
                                            />
                                        ))}

                                        {filtersActive &&
                                            tasks.length === 0 &&
                                            totalCount > 0 && (
                                                <Typography
                                                    variant="body2"
                                                    sx={{
                                                        color: harbor.sub,
                                                        fontSize: "12.5px",
                                                        px: "6px",
                                                        py: 1,
                                                    }}
                                                >
                                                    No matching tasks
                                                </Typography>
                                            )}

                                        {/* Loading indicator */}
                                        {isLoading && (
                                            <Box
                                                sx={{
                                                    display: "flex",
                                                    justifyContent: "center",
                                                    py: 1,
                                                }}
                                            >
                                                <CircularProgress
                                                    size={20}
                                                    aria-label="Loading more tasks"
                                                />
                                            </Box>
                                        )}

                                        {/* Load more button as fallback */}
                                        {hasMore && !isLoading && (
                                            <Button
                                                size="small"
                                                onClick={() =>
                                                    loadMoreForColumn(column.id)
                                                }
                                                sx={{
                                                    fontSize: "12px",
                                                    textTransform: "none",
                                                    color: harbor.sub,
                                                    alignSelf: "center",
                                                }}
                                            >
                                                Load more ({allColTasks.length}{" "}
                                                of {totalCount})
                                            </Button>
                                        )}

                                        <QuickCreateTask
                                            teamSlug={team.slug}
                                            boardSlug={board.slug}
                                            columnId={column.id}
                                            columnName={column.name}
                                            templates={taskTemplates}
                                            disabled={atWipLimit}
                                            wipLimit={column.wip_limit}
                                            taskCount={totalCount}
                                        />
                                    </DroppableColumnBody>
                                </SortableContext>
                            </Paper>
                        );
                    })}
                </Box>

                {/* Edge fades + scroll buttons show there are more columns.
                    Mouse-only helpers: keyboard focus scrolls columns into
                    view on its own. */}
                {edges.left && (
                    <ScrollEdge side="left" onClick={() => scrollStrip(-1)} />
                )}
                {edges.right && (
                    <ScrollEdge side="right" onClick={() => scrollStrip(1)} />
                )}
            </Box>

            {/* Drag overlay */}
            <DragOverlay>
                {activeTask ? (
                    <Box
                        aria-hidden
                        sx={{
                            opacity: 0.95,
                            transform: "rotate(2deg)",
                            filter: "drop-shadow(0 10px 18px rgba(34, 41, 53, 0.18))",
                        }}
                    >
                        <TaskCard task={activeTask} />
                    </Box>
                ) : null}
            </DragOverlay>
        </DndContext>
    );
}

function ScrollEdge({
    side,
    onClick,
}: {
    side: "left" | "right";
    onClick: () => void;
}) {
    return (
        <Box
            aria-hidden
            sx={{
                position: "absolute",
                top: 0,
                bottom: 8,
                [side]: 0,
                width: 40,
                pointerEvents: "none",
                background: `linear-gradient(to ${side === "left" ? "right" : "left"}, ${harbor.canvas}, transparent)`,
                display: "flex",
                alignItems: "flex-start",
                justifyContent: side === "left" ? "flex-start" : "flex-end",
                pt: "10px",
                px: "4px",
            }}
        >
            <IconButton
                tabIndex={-1}
                size="small"
                onClick={onClick}
                sx={{
                    pointerEvents: "auto",
                    width: 30,
                    height: 30,
                    bgcolor: harbor.card,
                    color: harbor.ink,
                    boxShadow: harbor.cardShadowHover,
                    "&:hover": { bgcolor: harbor.card },
                    // Touch users swipe; the buttons are for mouse users
                    "@media (hover: none)": { display: "none" },
                }}
            >
                {side === "left" ? (
                    <ChevronLeftIcon fontSize="small" />
                ) : (
                    <ChevronRightIcon fontSize="small" />
                )}
            </IconButton>
        </Box>
    );
}
