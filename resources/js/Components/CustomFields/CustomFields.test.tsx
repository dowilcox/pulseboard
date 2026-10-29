import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { Autosave } from "@/hooks/useAutosave";
import type { BoardCustomField, Task } from "@/types";
import TaskCardCustomFields from "./TaskCardCustomFields";
import TaskCustomFieldsSection from "./TaskCustomFieldsSection";

afterEach(cleanup);

function field(overrides: Partial<BoardCustomField>): BoardCustomField {
    return {
        id: "f",
        board_id: "b",
        name: "Field",
        type: "text",
        options: null,
        sort_order: 0,
        show_on_card: false,
        created_at: "",
        updated_at: "",
        ...overrides,
    };
}

function fakeAutosave(busy = () => false): Autosave {
    return {
        status: "idle",
        errorMessage: null,
        schedule: vi.fn(),
        saveNow: vi.fn(() => Promise.resolve()),
        flush: vi.fn(() => Promise.resolve()),
        retry: vi.fn(),
        cancel: vi.fn(),
        discard: vi.fn(),
        isBusy: vi.fn(busy),
    };
}

const customer = field({ id: "customer", name: "Customer" });
const points = field({ id: "points", name: "Points", type: "number" });
const done = field({ id: "done", name: "Signed off", type: "checkbox" });

describe("TaskCustomFieldsSection", () => {
    it("renders nothing without fields", () => {
        const { container } = render(
            <TaskCustomFieldsSection
                task={{ id: "t", custom_fields: null }}
                fields={[]}
                autosave={fakeAutosave()}
                canEdit
            />,
        );
        expect(container.firstChild).toBeNull();
    });

    it("saves edits as a partial custom_fields map", () => {
        const autosave = fakeAutosave();
        render(
            <TaskCustomFieldsSection
                task={{ id: "t", custom_fields: { customer: "Acme" } }}
                fields={[customer, points, done]}
                autosave={autosave}
                canEdit
            />,
        );

        expect(screen.getByLabelText("Customer")).toHaveValue("Acme");

        fireEvent.change(screen.getByLabelText("Points"), {
            target: { value: "5" },
        });
        expect(autosave.schedule).toHaveBeenLastCalledWith(
            "custom_fields",
            { points: 5 },
            600,
        );
    });

    it("merges edits to several fields while a save is pending", () => {
        let busy = false;
        const autosave = fakeAutosave(() => busy);
        render(
            <TaskCustomFieldsSection
                task={{ id: "t", custom_fields: null }}
                fields={[customer, done]}
                autosave={autosave}
                canEdit
            />,
        );

        fireEvent.change(screen.getByLabelText("Customer"), {
            target: { value: "Acme " },
        });
        busy = true;
        fireEvent.click(screen.getByLabelText("Signed off"));

        expect(autosave.schedule).toHaveBeenLastCalledWith(
            "custom_fields",
            { customer: "Acme", done: true },
            0,
        );
    });

    it("disables editors without edit permission", () => {
        render(
            <TaskCustomFieldsSection
                task={{ id: "t", custom_fields: null }}
                fields={[customer]}
                autosave={fakeAutosave()}
                canEdit={false}
            />,
        );
        expect(screen.getByLabelText("Customer")).toBeDisabled();
    });
});

describe("TaskCardCustomFields", () => {
    it("shows only non-empty show-on-card fields", () => {
        const severity = field({
            id: "sev",
            name: "Severity",
            type: "select",
            show_on_card: true,
            options: [{ id: "hi", label: "High", color: "#ef4444" }],
        });
        const hidden = field({ id: "h", name: "Hidden" });
        const empty = field({ id: "e", name: "Empty", show_on_card: true });
        const task = {
            custom_fields: { sev: "hi", h: "secret" },
        } as Pick<Task, "custom_fields">;

        render(
            <TaskCardCustomFields
                fields={[severity, hidden, empty]}
                task={task}
            />,
        );

        expect(screen.getByText("High")).toBeInTheDocument();
        expect(screen.queryByText("secret")).toBeNull();
        expect(screen.queryByText("Empty")).toBeNull();
    });
});
