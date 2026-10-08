import {
    act,
    cleanup,
    fireEvent,
    render,
    screen,
    waitFor,
    within,
} from "@testing-library/react";
import type { AnchorHTMLAttributes } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    visit: vi.fn(),
    axiosGet: vi.fn(),
    pageProps: {} as Record<string, unknown>,
}));

vi.mock("@inertiajs/react", () => ({
    Link: ({
        href,
        children,
        ...rest
    }: AnchorHTMLAttributes<HTMLAnchorElement>) => (
        <a href={href} {...rest}>
            {children}
        </a>
    ),
    router: { visit: mocks.visit, on: () => () => {} },
    usePage: () => ({ props: mocks.pageProps }),
}));

vi.mock("axios", () => ({
    default: {
        get: mocks.axiosGet,
        isCancel: () => false,
        isAxiosError: () => false,
    },
}));

import QuickSwitcher from "./QuickSwitcher";

function fakeRoute(name: string, params?: unknown): string {
    if (name === "search") {
        return `/search?q=${(params as { q: string }).q}`;
    }
    const parts = Array.isArray(params) ? params : params ? [params] : [];
    return `/${[name, ...parts].join("/")}`;
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

const board = (id: string, name: string, teamId: string) => ({
    id,
    team_id: teamId,
    name,
    slug: id,
    is_archived: false,
    sort_order: 0,
    created_at: "",
    updated_at: "",
});

function pressCtrlK() {
    fireEvent.keyDown(window, { key: "k", code: "KeyK", ctrlKey: true });
}

function combobox() {
    return screen.getByRole("combobox");
}

describe("QuickSwitcher", () => {
    beforeEach(() => {
        vi.stubGlobal("route", fakeRoute);
        vi.stubGlobal("localStorage", memoryStorage());
        vi.spyOn(navigator, "platform", "get").mockReturnValue("Win32");
        localStorage.setItem(
            "pulseboard-recent-boards",
            JSON.stringify(["brand", "gone"]),
        );
        mocks.visit.mockReset();
        mocks.axiosGet.mockReset();
        mocks.pageProps = {
            auth: {
                user: {
                    id: "u1",
                    name: "Alice",
                    is_admin: false,
                    ui_preferences: { starred_boards: ["web"] },
                },
            },
            teams: [
                {
                    id: "eng",
                    name: "Engineering",
                    slug: "engineering",
                    boards: [
                        board("web", "Website", "eng"),
                        board("api", "Public API", "eng"),
                    ],
                },
                {
                    id: "des",
                    name: "Design",
                    slug: "design",
                    boards: [board("brand", "Brand refresh", "des")],
                },
            ],
        };
    });

    afterEach(() => {
        // Vitest globals are off, so Testing Library can't auto-clean.
        cleanup();
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    it("renders an accessible trigger with the platform shortcut", () => {
        render(<QuickSwitcher />);
        // The wide trigger's name includes its visible "Search… Ctrl K" label;
        // the compact icon button is just "Search".
        const wide = screen.getByRole("button", { name: "Search… Ctrl K" });
        expect(wide).toHaveAttribute("aria-keyshortcuts", "Control+K /");
        expect(
            screen.getByRole("button", { name: "Search" }),
        ).toHaveAttribute("aria-keyshortcuts", "Control+K /");
        expect(screen.getByText("Ctrl K")).toBeInTheDocument();
    });

    it("toggles with Ctrl+K and shows starred, recent and pages", async () => {
        render(<QuickSwitcher />);
        pressCtrlK();

        const listbox = await screen.findByRole("listbox");
        const starred = within(listbox).getByRole("group", { name: "Starred" });
        expect(within(starred).getByRole("option")).toHaveTextContent(
            "Website",
        );

        const recent = within(listbox).getByRole("group", { name: "Recent" });
        // Unknown ids ("gone") are dropped.
        expect(within(recent).getAllByRole("option")).toHaveLength(1);
        expect(within(recent).getByRole("option")).toHaveTextContent(
            "Brand refresh",
        );

        const pages = within(listbox).getByRole("group", { name: "Pages" });
        expect(
            within(pages)
                .getAllByRole("option")
                .map((o) => o.textContent),
        ).toEqual(["Dashboard", "All teams", "Profile"]);

        pressCtrlK();
        await waitFor(() =>
            expect(screen.queryByRole("listbox")).not.toBeInTheDocument(),
        );
    });

    it("opens with / unless focus is in a text field", async () => {
        render(
            <>
                <input aria-label="Other field" />
                <QuickSwitcher />
            </>,
        );

        const field = screen.getByLabelText("Other field");
        field.focus();
        fireEvent.keyDown(field, { key: "/" });
        expect(screen.queryByRole("combobox")).not.toBeInTheDocument();

        fireEvent.keyDown(document.body, { key: "/" });
        expect(await screen.findByRole("combobox")).toBeInTheDocument();
    });

    it("filters boards, moves with arrows and opens with Enter", async () => {
        render(<QuickSwitcher />);
        pressCtrlK();
        const input = await screen.findByRole("combobox");

        fireEvent.change(input, { target: { value: "b" } });

        const boards = screen.getByRole("group", { name: "Boards" });
        const options = within(boards).getAllByRole("option");
        // "Brand refresh" (prefix) ranks above the substring matches, which
        // are alphabetical.
        expect(options).toHaveLength(3);
        expect(options[0]).toHaveTextContent("Brand refreshDesign");
        expect(options[1]).toHaveTextContent("Public APIEngineering");
        expect(options[2]).toHaveTextContent("WebsiteEngineering");
        expect(options[0]).toHaveAttribute(
            "href",
            "/teams.boards.show/design/brand",
        );
        expect(input).toHaveAttribute("aria-activedescendant", options[0].id);
        expect(options[0]).toHaveAttribute("aria-selected", "true");

        fireEvent.keyDown(input, { key: "ArrowDown" });
        expect(input).toHaveAttribute("aria-activedescendant", options[1].id);
        expect(options[1]).toHaveAttribute("aria-selected", "true");

        // Up from the first option wraps to the last result overall.
        fireEvent.keyDown(input, { key: "ArrowUp" });
        fireEvent.keyDown(input, { key: "ArrowUp" });
        const all = screen.getAllByRole("option");
        expect(input).toHaveAttribute(
            "aria-activedescendant",
            all[all.length - 1].id,
        );

        fireEvent.keyDown(input, { key: "ArrowDown" });
        fireEvent.keyDown(input, { key: "ArrowDown" });
        fireEvent.keyDown(input, { key: "Enter" });
        expect(mocks.visit).toHaveBeenCalledWith(
            "/teams.boards.show/engineering/api",
        );
    });

    it("opens the active result in a new tab with Ctrl+Enter", async () => {
        const open = vi.spyOn(window, "open").mockReturnValue(null);
        render(<QuickSwitcher />);
        pressCtrlK();
        const input = await screen.findByRole("combobox");

        fireEvent.change(input, { target: { value: "web" } });
        fireEvent.keyDown(input, { key: "Enter", ctrlKey: true });

        expect(open).toHaveBeenCalledWith(
            "/teams.boards.show/engineering/web",
            "_blank",
            "noopener",
        );
        expect(mocks.visit).not.toHaveBeenCalled();
    });

    it("searches tasks on the server after a short debounce", async () => {
        mocks.axiosGet.mockResolvedValue({
            data: {
                tasks: [
                    {
                        id: "t1",
                        task_number: 12,
                        title: "Fix login",
                        slug: "12-fix-login",
                        completed_at: null,
                        board: { name: "Website", slug: "web" },
                        team: { name: "Engineering", slug: "engineering" },
                        column: { name: "In Progress" },
                    },
                ],
            },
        });

        render(<QuickSwitcher />);
        pressCtrlK();
        const input = await screen.findByRole("combobox");

        // One character is not enough for a task search.
        fireEvent.change(input, { target: { value: "f" } });
        expect(
            screen.getByText("Type at least 2 characters to search tasks."),
        ).toBeInTheDocument();

        fireEvent.change(input, { target: { value: "fix" } });
        expect(screen.getByText("Searching tasks…")).toBeInTheDocument();

        const tasks = await screen.findByRole("group", { name: "Tasks" });
        expect(mocks.axiosGet).toHaveBeenCalledTimes(1);
        expect(mocks.axiosGet.mock.calls[0][0]).toBe("/search?q=fix");

        const option = within(tasks).getByRole("option");
        expect(option).toHaveTextContent("#12Fix login");
        expect(option).toHaveTextContent("Engineering › Website · In Progress");
        expect(option).toHaveAttribute(
            "href",
            "/tasks.show/engineering/web/12-fix-login",
        );
    });

    it("shows an error with a retry when task search fails", async () => {
        mocks.axiosGet.mockRejectedValueOnce(new Error("boom"));
        mocks.axiosGet.mockResolvedValueOnce({ data: { tasks: [] } });

        render(<QuickSwitcher />);
        pressCtrlK();
        const input = await screen.findByRole("combobox");
        fireEvent.change(input, { target: { value: "zz" } });

        const retry = await screen.findByRole("button", { name: "Retry" });
        expect(screen.getByText("Couldn't search tasks.")).toBeInTheDocument();

        await act(async () => {
            fireEvent.click(retry);
        });

        expect(
            await screen.findByText("No results for “zz”"),
        ).toBeInTheDocument();
        expect(mocks.axiosGet).toHaveBeenCalledTimes(2);
    });
});
