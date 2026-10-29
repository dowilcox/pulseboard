import {
    act,
    cleanup,
    fireEvent,
    render,
    screen,
    within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
    KeyboardShortcutsProvider,
    type ShortcutDefinition,
    useShortcutHint,
    useShortcuts,
} from "./KeyboardShortcutsContext";
import { SINGLE_KEY_STORAGE_KEY } from "@/utils/keyboardShortcuts";

function Shortcuts({ defs }: { defs: ShortcutDefinition[] }) {
    useShortcuts(defs);
    return null;
}

function Hint({ spec }: { spec: string }) {
    return <span data-testid="hint">{useShortcutHint(spec)}</span>;
}

function press(
    key: string,
    init: KeyboardEventInit = {},
    target: Element = document.body,
) {
    fireEvent.keyDown(target, { key, ...init });
}

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

beforeEach(() => {
    vi.spyOn(navigator, "platform", "get").mockReturnValue("Win32");
    vi.stubGlobal("localStorage", memoryStorage());
});

afterEach(() => {
    // Vitest globals are off, so Testing Library can't auto-clean.
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});

describe("KeyboardShortcutsProvider", () => {
    it("runs single keys, modifiers and sequences", () => {
        const single = vi.fn();
        const mod = vi.fn();
        const sequence = vi.fn();
        render(
            <KeyboardShortcutsProvider>
                <Shortcuts
                    defs={[
                        {
                            id: "x",
                            keys: "x",
                            description: "X",
                            handler: single,
                        },
                        {
                            id: "k",
                            keys: "mod+k",
                            description: "K",
                            handler: mod,
                        },
                        {
                            id: "gd",
                            keys: "g d",
                            description: "GD",
                            handler: sequence,
                        },
                    ]}
                />
            </KeyboardShortcutsProvider>,
        );

        press("x");
        press("k", { ctrlKey: true });
        press("g");
        press("d");

        expect(single).toHaveBeenCalledTimes(1);
        expect(mod).toHaveBeenCalledTimes(1);
        expect(sequence).toHaveBeenCalledTimes(1);
    });

    it("stays quiet while typing, except for opted-in shortcuts", () => {
        const single = vi.fn();
        const escape = vi.fn();
        render(
            <KeyboardShortcutsProvider>
                <input aria-label="Field" />
                <div contentEditable suppressContentEditableWarning>
                    <p>Editor</p>
                </div>
                <Shortcuts
                    defs={[
                        {
                            id: "x",
                            keys: "x",
                            description: "X",
                            handler: single,
                        },
                        {
                            id: "esc",
                            keys: "escape",
                            description: "Esc",
                            allowInInputs: true,
                            handler: escape,
                        },
                    ]}
                />
            </KeyboardShortcutsProvider>,
        );

        const field = screen.getByLabelText("Field");
        press("x", {}, field);
        press("x", {}, screen.getByText("Editor"));
        expect(single).not.toHaveBeenCalled();

        press("Escape", {}, field);
        expect(escape).toHaveBeenCalledTimes(1);
    });

    it("skips events a component already handled", () => {
        const handler = vi.fn();
        render(
            <KeyboardShortcutsProvider>
                <button onKeyDown={(e) => e.preventDefault()}>Owner</button>
                <Shortcuts
                    defs={[{ id: "x", keys: "x", description: "X", handler }]}
                />
            </KeyboardShortcutsProvider>,
        );
        press("x", {}, screen.getByText("Owner"));
        expect(handler).not.toHaveBeenCalled();
    });

    it("lets the innermost scope win and falls through when it declines", () => {
        const calls: string[] = [];
        const { rerender } = render(
            <KeyboardShortcutsProvider>
                <Shortcuts
                    defs={[
                        {
                            id: "task-c",
                            keys: "c",
                            description: "Task c",
                            scope: "task",
                            handler: () => void calls.push("task"),
                        },
                    ]}
                />
                <Shortcuts
                    defs={[
                        {
                            id: "global-c",
                            keys: "c",
                            description: "Global c",
                            handler: () => void calls.push("global"),
                        },
                    ]}
                />
            </KeyboardShortcutsProvider>,
        );

        press("c");
        expect(calls).toEqual(["task"]);

        rerender(
            <KeyboardShortcutsProvider>
                <Shortcuts
                    defs={[
                        {
                            id: "task-c",
                            keys: "c",
                            description: "Task c",
                            scope: "task",
                            handler: () => {
                                calls.push("task declined");
                                return false;
                            },
                        },
                    ]}
                />
                <Shortcuts
                    defs={[
                        {
                            id: "global-c",
                            keys: "c",
                            description: "Global c",
                            handler: () => void calls.push("global"),
                        },
                    ]}
                />
            </KeyboardShortcutsProvider>,
        );
        press("c");
        expect(calls).toEqual(["task", "task declined", "global"]);
    });

    it("unregisters on unmount", () => {
        const handler = vi.fn();
        const { rerender } = render(
            <KeyboardShortcutsProvider>
                <Shortcuts
                    defs={[{ id: "x", keys: "x", description: "X", handler }]}
                />
            </KeyboardShortcutsProvider>,
        );
        rerender(<KeyboardShortcutsProvider>{null}</KeyboardShortcutsProvider>);
        press("x");
        expect(handler).not.toHaveBeenCalled();
    });

    it("opens a help overlay listing the registered shortcuts by scope", async () => {
        render(
            <KeyboardShortcutsProvider>
                <Shortcuts
                    defs={[
                        {
                            id: "go",
                            keys: "g d",
                            description: "Go to dashboard",
                            handler: () => {},
                        },
                        {
                            id: "next",
                            keys: ["j", "arrowdown"],
                            description: "Next task",
                            scope: "board",
                            group: "Navigate",
                            handler: () => {},
                        },
                        {
                            id: "secret",
                            keys: "z",
                            description: "Hidden one",
                            hidden: true,
                            handler: () => {},
                        },
                    ]}
                />
            </KeyboardShortcutsProvider>,
        );

        press("?", { shiftKey: true });
        const dialog = await screen.findByRole("dialog", {
            name: "Keyboard shortcuts",
        });

        const everywhere = within(dialog).getByRole("region", {
            name: "Everywhere",
        });
        expect(
            within(everywhere).getByText("Go to dashboard"),
        ).toBeInTheDocument();
        expect(
            within(everywhere).getByText("Show keyboard shortcuts"),
        ).toBeInTheDocument();
        // Windows/Linux labels for the help shortcut's modifier form.
        expect(within(everywhere).getByText("Ctrl")).toBeInTheDocument();

        const board = within(dialog).getByRole("region", { name: "Board" });
        expect(within(board).getByText("Navigate")).toBeInTheDocument();
        expect(within(board).getByText("Next task")).toBeInTheDocument();
        expect(within(board).getByText("↓")).toBeInTheDocument();

        expect(
            within(dialog).queryByText("Hidden one"),
        ).not.toBeInTheDocument();
    });

    it("turns single-key shortcuts off (persisted) but keeps modifier ones", async () => {
        const single = vi.fn();
        const mod = vi.fn();
        render(
            <KeyboardShortcutsProvider>
                <Hint spec="x" />
                <Shortcuts
                    defs={[
                        {
                            id: "x",
                            keys: "x",
                            description: "Single",
                            handler: single,
                        },
                        {
                            id: "k",
                            keys: "mod+k",
                            description: "Mod",
                            handler: mod,
                        },
                    ]}
                />
            </KeyboardShortcutsProvider>,
        );
        expect(screen.getByTestId("hint")).toHaveTextContent("x");

        press("/", { ctrlKey: true });
        const dialog = await screen.findByRole("dialog", {
            name: "Keyboard shortcuts",
        });
        const toggle = within(dialog).getByRole("checkbox", {
            name: "Single-key shortcuts",
        });
        expect(toggle).toBeChecked();
        act(() => {
            fireEvent.click(toggle);
        });
        expect(toggle).not.toBeChecked();
        expect(localStorage.getItem(SINGLE_KEY_STORAGE_KEY)).toBe("off");
        expect(within(dialog).getByText("Single")).toBeInTheDocument();
        expect(within(dialog).getAllByText("(off)").length).toBeGreaterThan(0);

        press("x");
        press("k", { ctrlKey: true });
        expect(single).not.toHaveBeenCalled();
        expect(mod).toHaveBeenCalledTimes(1);
        expect(screen.getByTestId("hint")).toHaveTextContent("");
    });

    it("reads the stored preference on mount", () => {
        localStorage.setItem(SINGLE_KEY_STORAGE_KEY, "off");
        const single = vi.fn();
        render(
            <KeyboardShortcutsProvider>
                <Shortcuts
                    defs={[
                        {
                            id: "x",
                            keys: "x",
                            description: "X",
                            handler: single,
                        },
                    ]}
                />
            </KeyboardShortcutsProvider>,
        );
        press("x");
        expect(single).not.toHaveBeenCalled();
    });
});
