import {
    act,
    cleanup,
    fireEvent,
    render,
    screen,
    within,
} from "@testing-library/react";
import { router } from "@inertiajs/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Column, Task, User } from "@/types";
import { KeyboardShortcutsProvider } from "@/Contexts/KeyboardShortcutsContext";
import KanbanView from "@/Components/Views/KanbanView";
import ListView from "@/Components/Views/ListView";
import { BOARD_NAV_ATTR, BoardKeyboardProvider } from "./BoardKeyboard";

const me = { id: "me", name: "Me Myself" } as User;

function task(
    id: string,
    columnId: string,
    sort: number,
    extra: Partial<Task> = {},
): Task {
    return {
        id,
        board_id: "b",
        column_id: columnId,
        task_number: sort,
        slug: `${sort}-${id}`,
        title: `Task ${id}`,
        priority: "none",
        sort_order: sort,
        custom_fields: {},
        created_by: "u",
        created_at: "",
        updated_at: "",
        assignees: [],
        labels: [],
        ...extra,
    } as Task;
}

function column(
    id: string,
    name: string,
    tasks: Task[],
    extra: Partial<Column> = {},
): Column {
    return {
        id,
        board_id: "b",
        name,
        color: "",
        sort_order: 0,
        is_done_column: false,
        created_at: "",
        updated_at: "",
        tasks,
        tasks_count: tasks.length,
        ...extra,
    } as Column;
}

const team = { id: "t", slug: "team", name: "Team" };
const board = { id: "b", slug: "board", name: "Board" };

function memoryStorage(): Storage {
    const store = new Map<string, string>();
    return {
        get length() {
            return store.size;
        },
        clear: () => store.clear(),
        getItem: (key) => store.get(key) ?? null,
        key: (index) => [...store.keys()][index] ?? null,
        removeItem: (key) => void store.delete(key),
        setItem: (key, value) => void store.set(key, String(value)),
    };
}

function renderBoard(columns: Column[], view: "kanban" | "list" = "kanban") {
    const openNewTask = vi.fn();
    const allTasks = columns.flatMap((c) => c.tasks ?? []);
    const utils = render(
        <KeyboardShortcutsProvider>
            <BoardKeyboardProvider
                team={team}
                board={board}
                columns={columns}
                members={[me]}
                labels={[]}
                currentUserId={me.id}
                view={view}
                onViewChange={() => {}}
                canManage
                openNewTask={openNewTask}
            >
                <div {...{ [BOARD_NAV_ATTR]: "" }}>
                    {view === "kanban" ? (
                        <KanbanView
                            columns={columns}
                            board={board}
                            team={team}
                            filterFn={() => true}
                        />
                    ) : (
                        <ListView
                            columns={columns}
                            board={board}
                            team={team}
                            tasks={allTasks}
                            complete
                            loading={false}
                            filterFn={() => true}
                            filtersActive={false}
                            onClearFilters={() => {}}
                        />
                    )}
                </div>
            </BoardKeyboardProvider>
        </KeyboardShortcutsProvider>,
    );
    return { ...utils, openNewTask };
}

const card = (id: string) =>
    document.querySelector<HTMLElement>(`[data-task-id="${id}"]`)!;

function press(key: string, init: KeyboardEventInit = {}) {
    act(() => {
        fireEvent.keyDown(document.activeElement ?? document.body, {
            key,
            ...init,
        });
    });
}

let patch: ReturnType<typeof vi.spyOn>;
let put: ReturnType<typeof vi.spyOn>;
let visit: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
    vi.stubGlobal(
        "route",
        (name: string, params: unknown[] | string = []) =>
            `/${name}/${([] as unknown[]).concat(params).join("/")}`,
    );
    vi.stubGlobal(
        "IntersectionObserver",
        class {
            observe() {}
            disconnect() {}
        },
    );
    vi.stubGlobal("localStorage", memoryStorage());
    vi.stubGlobal("sessionStorage", memoryStorage());
    vi.spyOn(navigator, "platform", "get").mockReturnValue("Win32");
    patch = vi.spyOn(router, "patch").mockImplementation(() => {});
    put = vi.spyOn(router, "put").mockImplementation(() => {});
    visit = vi.spyOn(router, "visit").mockImplementation(() => {});
});

afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});

describe("board keyboard navigation (Kanban)", () => {
    const columns = () => [
        column("todo", "To do", [task("a", "todo", 1), task("b", "todo", 2)]),
        column("doing", "Doing", [task("c", "doing", 3)]),
        column("done", "Done", [], { wip_limit: 1, tasks_count: 1 }),
    ];

    it("uses a roving tab stop and moves a visible cursor with j/k/h/l", () => {
        renderBoard(columns());

        expect(card("a")).toHaveAttribute("tabindex", "0");
        expect(card("b")).toHaveAttribute("tabindex", "-1");
        expect(card("a")).not.toHaveAttribute("aria-current");

        press("j");
        expect(card("a")).toHaveAttribute("aria-current", "true");
        expect(document.activeElement).toBe(card("a"));

        press("j");
        expect(card("b")).toHaveAttribute("aria-current", "true");
        expect(card("b")).toHaveAttribute("tabindex", "0");
        expect(card("a")).toHaveAttribute("tabindex", "-1");

        press("ArrowRight");
        expect(card("c")).toHaveAttribute("aria-current", "true");
        expect(document.activeElement).toBe(card("c"));

        press("h");
        expect(card("a")).toHaveAttribute("aria-current", "true");

        press("Escape");
        expect(document.querySelector("[aria-current]")).toBeNull();
    });

    it("leaves plain arrow keys alone until there is a cursor", () => {
        renderBoard(columns());
        press("ArrowDown");
        expect(document.querySelector("[aria-current]")).toBeNull();
    });

    it("toggles completion and assigns me through the existing endpoints", () => {
        renderBoard(columns());
        press("j");
        press("x");
        expect(patch).toHaveBeenCalledWith(
            "/tasks.toggle-complete/team/board/1-a",
            {},
            expect.objectContaining({ preserveScroll: true }),
        );

        press("i");
        expect(put).toHaveBeenCalledWith(
            "/tasks.assignees.update/team/board/1-a",
            { user_ids: ["me"] },
            expect.objectContaining({ preserveScroll: true }),
        );

        press("2");
        expect(put).toHaveBeenCalledWith(
            "/tasks.update/team/board/1-a",
            { priority: "high" },
            expect.anything(),
        );
    });

    it("reorders and moves cards optimistically, respecting WIP limits", () => {
        renderBoard(columns());
        press("j");

        // ⇧J: "a" goes below "b"
        press("J", { shiftKey: true });
        expect(patch).toHaveBeenLastCalledWith(
            "/tasks.move/team/board/1-a",
            { column_id: "todo", sort_order: 3 },
            expect.anything(),
        );
        const todo = screen.getByRole("region", { name: /To do/ });
        const order = within(todo)
            .getAllByRole("link")
            .map((el) => el.getAttribute("data-task-id"));
        expect(order).toEqual(["b", "a"]);
        expect(card("a")).toHaveAttribute("aria-current", "true");

        // ⇧L: into "Doing", keeping the row (clamped to the end)
        press("L", { shiftKey: true });
        expect(patch).toHaveBeenLastCalledWith(
            "/tasks.move/team/board/1-a",
            { column_id: "doing", sort_order: 4 },
            expect.anything(),
        );

        // ⇧L again: "Done" is at its WIP limit, so nothing is sent
        patch.mockClear();
        press("L", { shiftKey: true });
        expect(patch).not.toHaveBeenCalled();
    });

    it("opens a searchable move-to-column picker", () => {
        renderBoard(columns());
        press("j");
        press("m");

        const input = screen.getByRole("combobox", {
            name: "Move #1 Task a to column",
        });
        expect(input).toHaveFocus();
        const listbox = screen.getByRole("listbox");
        expect(
            within(listbox).getByRole("option", { name: /To do/ }),
        ).toHaveAttribute("aria-disabled", "true");
        expect(
            within(listbox).getByRole("option", { name: /Done/ }),
        ).toHaveAttribute("aria-disabled", "true");

        fireEvent.click(within(listbox).getByRole("option", { name: "Doing" }));
        expect(patch).toHaveBeenCalledWith(
            "/tasks.move/team/board/1-a",
            { column_id: "doing", sort_order: 4 },
            expect.anything(),
        );
    });

    it("opens the focused task with o", () => {
        renderBoard(columns());
        press("j");
        press("j");
        // Focus is on the card link, where Enter is native; "o" always works.
        press("Enter");
        expect(visit).not.toHaveBeenCalled();
        press("o");
        expect(visit).toHaveBeenCalledWith("/tasks.show/team/board/2-b");
    });

    it("opens quick-create in the focused column with c", () => {
        renderBoard(columns());
        press("l");
        press("l");
        expect(card("c")).toHaveAttribute("aria-current", "true");
        press("c");
        expect(
            screen.getByRole("textbox", { name: "New task title in Doing" }),
        ).toBeInTheDocument();
    });
});

describe("board keyboard navigation (List)", () => {
    it("moves through rows and offers the New task dialog for c", () => {
        const { openNewTask } = renderBoard(
            [
                column("todo", "To do", [task("a", "todo", 1)]),
                column("done", "Done", [task("b", "done", 2)]),
            ],
            "list",
        );
        press("j");
        expect(card("a")).toHaveAttribute("aria-current", "true");
        press("j");
        expect(card("b")).toHaveAttribute("aria-current", "true");
        // No columns in List view: h/l do nothing.
        press("h");
        expect(card("b")).toHaveAttribute("aria-current", "true");

        press("c");
        expect(openNewTask).toHaveBeenCalledWith("done");

        // ⇧H moves the row's task to the previous status.
        press("H", { shiftKey: true });
        expect(patch).toHaveBeenCalledWith(
            "/tasks.move/team/board/2-b",
            { column_id: "todo", sort_order: null },
            expect.anything(),
        );
    });
});
