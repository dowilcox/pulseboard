import { useShortcuts } from "@/Contexts/KeyboardShortcutsContext";
import { useSnackbar } from "@/Contexts/SnackbarContext";
import type { Task, TaskPermissions, TaskSummary } from "@/types";
import { toggleTaskComplete, toggleTaskWatch } from "@/utils/taskActions";
import {
    adjacentTask,
    loadTaskNavOrder,
    setReturnFocus,
    type TaskNavEntry,
} from "@/utils/taskNavigation";
import { router } from "@inertiajs/react";
import { useEffect } from "react";

interface Props {
    task: Task;
    team: { slug: string };
    board: { id: string; slug: string };
    /** Deferred dependency candidates; the fallback order for "[" / "]". */
    boardTasks: TaskSummary[];
    isWatching: boolean;
    can: TaskPermissions;
    onEditDescription: () => void;
}

/**
 * Shortcuts for an open task (Tasks/Show): back to the board, previous /
 * next task in the board's order, edit description, complete and watch.
 * The comment box registers its own "c". Renders nothing.
 */
export default function TaskPageShortcuts({
    task,
    team,
    board,
    boardTasks,
    isWatching,
    can,
    onEditDescription,
}: Props) {
    const { showSnackbar } = useSnackbar();

    // Going back to the board puts its keyboard cursor on this task.
    useEffect(() => setReturnFocus(board.id, task.id), [board.id, task.id]);

    const neighbour = (direction: 1 | -1): TaskNavEntry | null | undefined => {
        const order = loadTaskNavOrder();
        if (order?.boardId === board.id) {
            const inOrder = order.groups.some((group) =>
                group.some((entry) => entry.id === task.id),
            );
            if (inOrder) return adjacentTask(order.groups, task.id, direction);
        }
        // Opened from elsewhere: this column, by task number.
        const column = boardTasks
            .filter(
                (t) =>
                    (t.board_id ?? board.id) === board.id &&
                    t.column_id === task.column_id,
            )
            .map((t) => ({ id: t.id, slug: t.slug }));
        if (!column.some((t) => t.id === task.id)) return undefined;
        return adjacentTask([column], task.id, direction);
    };

    const step = (direction: 1 | -1) => {
        const next = neighbour(direction);
        if (next) {
            router.visit(
                route("tasks.show", [team.slug, board.slug, next.slug]),
            );
        } else if (next === null) {
            showSnackbar(
                direction === 1
                    ? "This is the last task in the column."
                    : "This is the first task in the column.",
                "info",
            );
        }
    };

    useShortcuts([
        {
            id: "task-back",
            keys: "escape",
            description: "Back to the board",
            scope: "task",
            essential: true,
            handler: () => {
                const order = loadTaskNavOrder();
                router.visit(
                    order?.boardId === board.id
                        ? order.url
                        : route("teams.boards.show", [team.slug, board.slug]),
                );
            },
        },
        {
            id: "task-prev",
            keys: "[",
            description: "Previous task",
            scope: "task",
            handler: () => step(-1),
        },
        {
            id: "task-next",
            keys: "]",
            description: "Next task",
            scope: "task",
            handler: () => step(1),
        },
        {
            id: "task-edit-description",
            keys: "e",
            description: "Edit the description",
            scope: "task",
            enabled: can.update,
            handler: onEditDescription,
        },
        {
            id: "task-toggle-complete",
            keys: "x",
            description: "Mark complete / reopen",
            scope: "task",
            enabled: can.update,
            handler: () => toggleTaskComplete(team.slug, board.slug, task),
        },
        {
            id: "task-toggle-watch",
            keys: "w",
            description: isWatching ? "Stop watching" : "Watch",
            scope: "task",
            handler: () =>
                toggleTaskWatch(team.slug, board.slug, task, {
                    onSuccess: () =>
                        showSnackbar(
                            isWatching
                                ? "You stopped watching this task."
                                : "You're watching this task.",
                            "success",
                        ),
                }),
        },
        {
            // Listed for discoverability; the editors handle the key.
            id: "task-submit-editor",
            keys: "mod+enter",
            description: "Save description / post comment (while writing)",
            scope: "task",
            allowInInputs: true,
            preventDefault: false,
            handler: () => false,
        },
    ]);

    return null;
}
