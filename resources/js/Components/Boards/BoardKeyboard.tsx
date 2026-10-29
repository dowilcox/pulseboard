import TaskQuickPicker, {
    PRIORITY_KEYS,
    type PickerKind,
} from "@/Components/Boards/TaskQuickPicker";
import { wipLimitMessage } from "@/Components/Tasks/QuickCreateTask";
import {
    type ShortcutDefinition,
    useKeyboardShortcuts,
    useShortcuts,
} from "@/Contexts/KeyboardShortcutsContext";
import { useSnackbar } from "@/Contexts/SnackbarContext";
import { PRIORITY_OPTIONS } from "@/constants/priorities";
import type { BoardViewMode, Column, Label, Task, User } from "@/types";
import {
    type FocusLayout,
    type FocusMove,
    type FocusPosition,
    type MoveTarget,
    locateTask,
    nextFocus,
    planColumnStep,
    planReorder,
    reconcileFocus,
    tabStopId as computeTabStop,
} from "@/utils/boardFocus";
import { getTaskLabel } from "@/utils/gitlabPrefix";
import { loadTaskNavOrder, saveTaskNavOrder } from "@/utils/taskNavigation";
import {
    moveTask as sendMove,
    toggledAssigneeIds,
    toggleTaskComplete,
    toggleTaskWatch,
    updateTaskAssignees,
    updateTaskFields,
    updateTaskLabels,
} from "@/utils/taskActions";
import { router } from "@inertiajs/react";
import Box from "@mui/material/Box";
import { visuallyHidden } from "@mui/utils";
import {
    createContext,
    type PropsWithChildren,
    type ReactNode,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";

/** Marks the region whose cards take part in keyboard navigation. */
export const BOARD_NAV_ATTR = "data-board-nav";
const CARD_SELECTOR = `[${BOARD_NAV_ATTR}] [data-task-id]`;

const VIEW_ORDER: BoardViewMode[] = ["kanban", "list", "workload"];

/** WIP limits of 0/null don't restrict (mirrors MoveTask::assertWipCapacity). */
export function isColumnAtWipLimit(column: Column, extra = 0): boolean {
    return (
        column.wip_limit != null &&
        column.wip_limit > 0 &&
        (column.tasks_count ?? column.tasks?.length ?? 0) + extra >=
            column.wip_limit
    );
}

interface BoardKeyboardValue {
    team: { id: string; slug: string; name: string };
    board: { id: string; slug: string; name: string };
    columns: Column[];
    members: User[];
    labels: Label[];
    currentUserId: string;
    focusedTaskId: string | null;
    setFocusedTaskId: (id: string | null) => void;
    openNewTask: (columnId?: string) => void;
}

const BoardKeyboardContext = createContext<BoardKeyboardValue | null>(null);

interface ProviderProps {
    team: BoardKeyboardValue["team"];
    board: BoardKeyboardValue["board"];
    columns: Column[];
    members: User[];
    labels: Label[];
    currentUserId: string;
    view: BoardViewMode;
    onViewChange: (view: BoardViewMode) => void;
    canManage: boolean;
    openNewTask: (columnId?: string) => void;
}

/**
 * Board-wide keyboard state (the focused-task cursor, kept across view
 * switches) and the shortcuts that don't depend on the current view.
 * Kanban and List add their navigation with `useBoardKeyboardNav`.
 */
export function BoardKeyboardProvider({
    children,
    team,
    board,
    columns,
    members,
    labels,
    currentUserId,
    view,
    onViewChange,
    canManage,
    openNewTask,
}: PropsWithChildren<ProviderProps>) {
    // Coming back from a task (Esc there), the cursor starts on it.
    const [focusedTaskId, setFocusedTaskId] = useState<string | null>(() => {
        const order = loadTaskNavOrder();
        return order?.boardId === board.id
            ? (order.returnFocusId ?? null)
            : null;
    });

    // A different board starts without a cursor.
    const boardIdRef = useRef(board.id);
    useEffect(() => {
        if (boardIdRef.current === board.id) return;
        boardIdRef.current = board.id;
        setFocusedTaskId(null);
    }, [board.id]);

    useShortcuts([
        {
            id: "board-search",
            keys: "f",
            description: "Search and filter tasks",
            scope: "board",
            group: "Board",
            handler: () => {
                const input = document.querySelector<HTMLInputElement>(
                    '[role="search"] input[aria-label="Search tasks"]',
                );
                if (!input) return false;
                input.focus();
                input.select();
            },
        },
        {
            id: "board-cycle-view",
            keys: "v",
            description: "Switch view (Board, List, Workload)",
            scope: "board",
            group: "Board",
            handler: () =>
                onViewChange(
                    VIEW_ORDER[
                        (VIEW_ORDER.indexOf(view) + 1) % VIEW_ORDER.length
                    ],
                ),
        },
        {
            id: "board-new-task",
            keys: "c",
            description: "Create a task",
            scope: "board",
            group: "Board",
            // Kanban and List register their own "c" (focused column).
            enabled: columns.length > 0 && view === "workload",
            handler: () => openNewTask(),
        },
        {
            id: "board-settings",
            keys: "g s",
            description: "Go to board settings",
            scope: "board",
            group: "Board",
            enabled: canManage,
            handler: () =>
                router.visit(
                    route("teams.boards.settings", [team.slug, board.slug]),
                ),
        },
    ]);

    const value = useMemo<BoardKeyboardValue>(
        () => ({
            team,
            board,
            columns,
            members,
            labels,
            currentUserId,
            focusedTaskId,
            setFocusedTaskId,
            openNewTask,
        }),
        [
            team,
            board,
            columns,
            members,
            labels,
            currentUserId,
            focusedTaskId,
            openNewTask,
        ],
    );

    return (
        <BoardKeyboardContext.Provider value={value}>
            {children}
        </BoardKeyboardContext.Provider>
    );
}

export interface BoardKeyboardNavOptions {
    view: "kanban" | "list";
    /** Visible tasks in display order (List: one pseudo-column of rows). */
    layout: FocusLayout;
    getTask: (id: string) => Task | undefined;
    /**
     * Apply and persist a move. Kanban passes its optimistic version; by
     * default the move is sent to the server and the board reloads.
     */
    moveTask?: (task: Task, target: MoveTarget) => void;
    /** Whether the target column can take another task. */
    isColumnFull?: (columnId: string) => boolean;
    /** ⇧J / ⇧K reorder within a column (Kanban only). */
    canReorder?: boolean;
    /** `c` creates in the focused column; defaults to the New task dialog. */
    createInColumn?: (columnId: string) => void;
    /** Pause navigation, e.g. while a card is being dragged. */
    suspended?: boolean;
}

export interface BoardKeyboardNav {
    /** The cursor: render this card with the focus ring. */
    focusedTaskId: string | null;
    /**
     * The roving tab stop (tabIndex 0; every other card gets -1), or null
     * when single-key shortcuts are off and cards keep their natural order.
     */
    tabStopId: string | null;
    /** Pickers + live region; render once inside the view. */
    overlay: ReactNode;
}

const INERT: BoardKeyboardNav = {
    focusedTaskId: null,
    tabStopId: null,
    overlay: null,
};

function findCard(taskId: string): HTMLElement | null {
    return document.querySelector<HTMLElement>(
        `[${BOARD_NAV_ATTR}] [data-task-id="${taskId}"]`,
    );
}

function isFocusVisible(el: Element): boolean {
    try {
        return el.matches(":focus-visible");
    } catch {
        return true;
    }
}

/**
 * Arrow keys only navigate from inside the board, or from the page itself
 * once there is a cursor — otherwise they keep scrolling the page.
 */
function arrowNavigates(event: KeyboardEvent, hasCursor: boolean): boolean {
    if (!event.key.startsWith("Arrow")) return true;
    const target = event.target;
    if (
        !(target instanceof Element) ||
        target === document.body ||
        target === document.documentElement
    ) {
        return hasCursor;
    }
    return target.closest(`[${BOARD_NAV_ATTR}]`) !== null;
}

/**
 * Keyboard navigation and task actions for a board view: the focused-task
 * cursor (j/k/h/l and arrows), open, create, complete, watch, assign,
 * labels, priority, due date and moves — all through the same endpoints as
 * the mouse UI. Inert outside a BoardKeyboardProvider.
 */
export function useBoardKeyboardNav({
    view,
    layout,
    getTask,
    moveTask,
    isColumnFull,
    canReorder = false,
    createInColumn,
    suspended = false,
}: BoardKeyboardNavOptions): BoardKeyboardNav {
    const ctx = useContext(BoardKeyboardContext);
    const { singleKeyEnabled } = useKeyboardShortcuts();
    const { showSnackbar } = useSnackbar();
    const [picker, setPicker] = useState<{
        kind: PickerKind;
        taskId: string;
    } | null>(null);
    const [announcement, setAnnouncement] = useState("");

    const focusedTaskId = ctx?.focusedTaskId ?? null;
    const setFocusedTaskId = ctx?.setFocusedTaskId;
    // The cursor's card should hold DOM focus (keyboard users); false after
    // focus moves elsewhere, so a re-render never steals it back.
    const domFocusRef = useRef(false);
    // Set while this hook focuses a card itself.
    const focusingRef = useRef(false);
    const focusCard = (card: HTMLElement) => {
        focusingRef.current = true;
        try {
            card.focus({ preventScroll: true });
        } finally {
            focusingRef.current = false;
        }
        card.scrollIntoView?.({ block: "nearest", inline: "nearest" });
    };
    const lastPositionRef = useRef<FocusPosition | null>(null);

    const columnOrder = useMemo(
        () => (ctx?.columns ?? []).map((c) => c.id),
        [ctx?.columns],
    );

    // ── Keep the cursor valid as the board changes ──────────────────────
    useEffect(() => {
        if (!setFocusedTaskId || !focusedTaskId) return;
        const position = locateTask(layout, focusedTaskId);
        if (position) {
            lastPositionRef.current = position;
            return;
        }
        // Nothing rendered yet (e.g. List still loading): keep the cursor.
        if (layout.every((c) => c.taskIds.length === 0)) return;
        const next = reconcileFocus(
            layout,
            focusedTaskId,
            lastPositionRef.current,
        );
        setFocusedTaskId(next);
    }, [layout, focusedTaskId, setFocusedTaskId]);

    // ── Remember the order for "[" / "]" on the task page ───────────────
    const orderRef = useRef({ layout, getTask });
    orderRef.current = { layout, getTask };
    const boardId = ctx?.board.id;
    useEffect(() => {
        if (!boardId) return;
        // Captured as a visit starts, so the URL includes current filters.
        return router.on("before", () => {
            const { layout: current, getTask: lookup } = orderRef.current;
            saveTaskNavOrder({
                boardId,
                url: window.location.pathname + window.location.search,
                groups: current.map((column) =>
                    column.taskIds.map((id) => ({
                        id,
                        slug: lookup(id)?.slug ?? id,
                    })),
                ),
                returnFocusId: null,
            });
        });
    }, [boardId]);

    // ── Follow Tab / programmatic focus onto cards ──────────────────────
    useEffect(() => {
        if (!setFocusedTaskId) return;
        const onFocusIn = (event: FocusEvent) => {
            const target = event.target;
            if (!(target instanceof Element)) return;
            const card = target.closest<HTMLElement>(CARD_SELECTOR);
            if (card) {
                // A mouse press focuses the link too; only keyboard focus
                // moves the visible cursor.
                if (!focusingRef.current && !isFocusVisible(card)) {
                    domFocusRef.current = false;
                    return;
                }
                domFocusRef.current = true;
                setFocusedTaskId(card.dataset.taskId ?? null);
            } else if (target !== document.body) {
                domFocusRef.current = false;
            }
        };
        document.addEventListener("focusin", onFocusIn);
        return () => document.removeEventListener("focusin", onFocusIn);
    }, [setFocusedTaskId]);

    // Move DOM focus to the cursor's card after keyboard moves, and again
    // if a re-render replaced the card (cross-column move, reload).
    useEffect(() => {
        if (!focusedTaskId || !domFocusRef.current || picker) return;
        const card = findCard(focusedTaskId);
        if (!card) return;
        const active = document.activeElement;
        if (active === card) return;
        if (
            active &&
            active !== document.body &&
            !active.closest(CARD_SELECTOR)
        ) {
            domFocusRef.current = false;
            return;
        }
        focusCard(card);
    });

    const announce = useCallback((message: string) => {
        // Re-announce identical messages by clearing first.
        setAnnouncement("");
        window.setTimeout(() => setAnnouncement(message), 30);
    }, []);

    const moveCursor = (move: FocusMove) => {
        if (!setFocusedTaskId) return false;
        const next = nextFocus(layout, focusedTaskId, move);
        if (!next) return false;
        domFocusRef.current = true;
        setFocusedTaskId(next);
        const card = next === focusedTaskId ? findCard(next) : null;
        if (card && document.activeElement !== card) focusCard(card);
    };

    const focusedTask = focusedTaskId ? getTask(focusedTaskId) : undefined;

    const columnName = (columnId: string) =>
        ctx?.columns.find((c) => c.id === columnId)?.name ?? "column";

    const columnFull = (columnId: string) => {
        if (isColumnFull) return isColumnFull(columnId);
        const column = ctx?.columns.find((c) => c.id === columnId);
        return column ? isColumnAtWipLimit(column) : false;
    };

    const performMove = (task: Task, target: MoveTarget) => {
        if (!ctx) return;
        if (target.columnId !== task.column_id && columnFull(target.columnId)) {
            const column = ctx.columns.find((c) => c.id === target.columnId);
            showSnackbar(
                `${column?.name ?? "That column"}: ${wipLimitMessage(
                    column?.tasks_count,
                    column?.wip_limit,
                )}`,
                "warning",
            );
            return;
        }
        domFocusRef.current = true;
        if (moveTask) {
            moveTask(task, target);
        } else {
            sendMove(ctx.team.slug, ctx.board.slug, task, {
                column_id: target.columnId,
                sort_order: null,
            });
        }
        const where =
            target.columnId !== task.column_id
                ? `to ${columnName(target.columnId)}`
                : target.visibleIndex === null
                  ? "to the end"
                  : `to position ${target.visibleIndex + 1}`;
        announce(`Moved ${getTaskLabel(task)} ${where}`);
    };

    /** Wrap an action that needs the focused task; declines without one. */
    const withTask =
        (action: (task: Task, event: KeyboardEvent) => void) =>
        (event: KeyboardEvent) => {
            if (!focusedTask) return false;
            action(focusedTask, event);
        };

    const openPicker = (kind: PickerKind) =>
        withTask((task) => setPicker({ kind, taskId: task.id }));

    const enabled = ctx !== null && !suspended;
    const kanban = view === "kanban";
    const slugs = ctx ? ([ctx.team.slug, ctx.board.slug] as const) : null;

    const shortcuts: ShortcutDefinition[] = [
        // ── Navigate ──
        {
            id: "nav-down",
            keys: ["j", "arrowdown"],
            description: kanban ? "Next task in column" : "Next task",
            group: "Navigate",
            handler: (event) =>
                arrowNavigates(event, focusedTaskId !== null) &&
                moveCursor("down"),
        },
        {
            id: "nav-up",
            keys: ["k", "arrowup"],
            description: kanban ? "Previous task in column" : "Previous task",
            group: "Navigate",
            handler: (event) =>
                arrowNavigates(event, focusedTaskId !== null) &&
                moveCursor("up"),
        },
        {
            id: "nav-left",
            keys: ["h", "arrowleft"],
            description: "Column to the left",
            group: "Navigate",
            enabled: kanban,
            handler: (event) =>
                arrowNavigates(event, focusedTaskId !== null) &&
                moveCursor("left"),
        },
        {
            id: "nav-right",
            keys: ["l", "arrowright"],
            description: "Column to the right",
            group: "Navigate",
            enabled: kanban,
            handler: (event) =>
                arrowNavigates(event, focusedTaskId !== null) &&
                moveCursor("right"),
        },
        {
            id: "nav-open",
            keys: ["enter", "o"],
            description: "Open the focused task",
            group: "Navigate",
            // On a focused card Enter follows its link natively.
            skipOnInteractive: true,
            handler: withTask((task) => {
                if (!slugs) return;
                router.visit(
                    route("tasks.show", [...slugs, task.slug ?? task.id]),
                );
            }),
        },
        {
            id: "nav-clear",
            keys: "escape",
            description: "Clear the focused task",
            group: "Navigate",
            essential: true,
            handler: () => {
                if (!focusedTaskId || !setFocusedTaskId) return false;
                domFocusRef.current = false;
                const active = document.activeElement;
                if (
                    active instanceof HTMLElement &&
                    active.closest(CARD_SELECTOR)
                ) {
                    active.blur();
                }
                setFocusedTaskId(null);
            },
        },

        // ── Task actions ──
        {
            id: "task-create",
            keys: "c",
            description: "Create a task in the focused column",
            group: "Task actions",
            handler: () => {
                if (!ctx) return false;
                const columnId =
                    focusedTask?.column_id ?? ctx.columns[0]?.id ?? null;
                if (!columnId) return false;
                if (createInColumn) {
                    if (columnFull(columnId)) {
                        const column = ctx.columns.find(
                            (c) => c.id === columnId,
                        );
                        showSnackbar(
                            wipLimitMessage(
                                column?.tasks_count,
                                column?.wip_limit,
                            ),
                            "warning",
                        );
                        return;
                    }
                    domFocusRef.current = false;
                    createInColumn(columnId);
                } else {
                    ctx.openNewTask(columnId);
                }
            },
        },
        {
            id: "task-complete",
            keys: "x",
            description: "Mark complete / reopen",
            group: "Task actions",
            handler: withTask((task) => {
                if (!slugs) return;
                toggleTaskComplete(...slugs, task);
                announce(
                    task.completed_at
                        ? `Reopened ${getTaskLabel(task)}`
                        : `Completed ${getTaskLabel(task)}`,
                );
            }),
        },
        {
            id: "task-watch",
            keys: "w",
            description: "Watch / unwatch",
            group: "Task actions",
            handler: withTask((task) => {
                if (!slugs) return;
                toggleTaskWatch(...slugs, task, {
                    onSuccess: () =>
                        showSnackbar(
                            `Toggled watching for ${getTaskLabel(task)}`,
                            "info",
                        ),
                });
            }),
        },
        {
            id: "task-assignees",
            keys: "a",
            description: "Assignees…",
            group: "Task actions",
            handler: openPicker("assignees"),
        },
        {
            id: "task-assign-me",
            keys: "i",
            description: "Assign / unassign me",
            group: "Task actions",
            handler: withTask((task) => {
                if (!slugs || !ctx) return;
                const ids = toggledAssigneeIds(task, ctx.currentUserId);
                updateTaskAssignees(...slugs, task, ids);
                announce(
                    ids.includes(ctx.currentUserId)
                        ? `Assigned ${getTaskLabel(task)} to you`
                        : `Unassigned you from ${getTaskLabel(task)}`,
                );
            }),
        },
        {
            id: "task-labels",
            keys: "t",
            description: "Labels…",
            group: "Task actions",
            handler: openPicker("labels"),
        },
        {
            id: "task-priority",
            keys: "p",
            description: "Priority…",
            group: "Task actions",
            handler: openPicker("priority"),
        },
        {
            id: "task-priority-direct",
            keys: Object.keys(PRIORITY_KEYS).sort((a, b) =>
                a === "0" ? 1 : b === "0" ? -1 : a.localeCompare(b),
            ),
            description: "Set priority: 1 urgent … 4 low, 0 none",
            group: "Task actions",
            handler: withTask((task, event) => {
                const priority = PRIORITY_KEYS[event.key];
                if (!slugs || !priority) return;
                if (priority !== task.priority) {
                    updateTaskFields(...slugs, task, { priority });
                }
                const label =
                    PRIORITY_OPTIONS.find((p) => p.value === priority)?.label ??
                    priority;
                announce(`Priority of ${getTaskLabel(task)} set to ${label}`);
            }),
        },
        {
            id: "task-due",
            keys: "d",
            description: "Due date…",
            group: "Task actions",
            handler: openPicker("due"),
        },

        // ── Move ──
        {
            id: "move-picker",
            keys: "m",
            description: "Move to column…",
            group: "Move",
            handler: openPicker("move"),
        },
        {
            id: "move-left",
            keys: "shift+h",
            description: "Move to previous column",
            group: "Move",
            handler: withTask((task) => {
                const target = planColumnStep(
                    columnOrder,
                    layoutWithCurrent(layout, task, view),
                    task.id,
                    -1,
                );
                if (target) performMove(task, target);
            }),
        },
        {
            id: "move-right",
            keys: "shift+l",
            description: "Move to next column",
            group: "Move",
            handler: withTask((task) => {
                const target = planColumnStep(
                    columnOrder,
                    layoutWithCurrent(layout, task, view),
                    task.id,
                    1,
                );
                if (target) performMove(task, target);
            }),
        },
        {
            id: "move-down",
            keys: "shift+j",
            description: "Move down in column",
            group: "Move",
            enabled: canReorder,
            handler: withTask((task) => {
                const target = planReorder(layout, task.id, 1);
                if (target) performMove(task, target);
            }),
        },
        {
            id: "move-up",
            keys: "shift+k",
            description: "Move up in column",
            group: "Move",
            enabled: canReorder,
            handler: withTask((task) => {
                const target = planReorder(layout, task.id, -1);
                if (target) performMove(task, target);
            }),
        },
    ];

    useShortcuts(
        shortcuts.map((d) => ({
            ...d,
            scope: "board",
            enabled: enabled && d.enabled !== false,
        })),
    );

    if (!ctx) return INERT;

    const pickerTask = picker ? (getTask(picker.taskId) ?? null) : null;
    const [teamSlug, boardSlug] = [ctx.team.slug, ctx.board.slug];

    const closePicker = () => {
        domFocusRef.current = true;
        setPicker(null);
    };

    const overlay = (
        <>
            <TaskQuickPicker
                kind={pickerTask ? picker!.kind : null}
                task={pickerTask}
                anchorEl={pickerTask ? findCard(pickerTask.id) : null}
                onClose={closePicker}
                members={ctx.members}
                labels={ctx.labels}
                columns={ctx.columns}
                isColumnFull={(column) => columnFull(column.id)}
                onAssigneesChange={(task, ids) =>
                    updateTaskAssignees(teamSlug, boardSlug, task, ids)
                }
                onLabelsChange={(task, ids) =>
                    updateTaskLabels(teamSlug, boardSlug, task, ids)
                }
                onPriorityChange={(task, priority) =>
                    updateTaskFields(teamSlug, boardSlug, task, { priority })
                }
                onDueDateChange={(task, due_date) =>
                    updateTaskFields(teamSlug, boardSlug, task, { due_date })
                }
                onMove={(task, columnId) =>
                    performMove(task, { columnId, visibleIndex: null })
                }
            />
            <Box role="status" aria-live="polite" sx={visuallyHidden}>
                {announcement}
            </Box>
        </>
    );

    return {
        focusedTaskId,
        tabStopId: singleKeyEnabled
            ? computeTabStop(layout, focusedTaskId)
            : null,
        overlay,
    };
}

/**
 * List view has no columns of its own: give ⇧H/⇧L a per-column position
 * (row 0) for the focused task so it steps to the neighbouring status.
 */
function layoutWithCurrent(
    layout: FocusLayout,
    task: Task,
    view: "kanban" | "list",
): FocusLayout {
    if (view === "kanban") return layout;
    return [{ id: task.column_id, taskIds: [task.id] }];
}
