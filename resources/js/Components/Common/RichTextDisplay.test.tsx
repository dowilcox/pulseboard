import { describe, it, expect, vi } from "vitest";
import { render, fireEvent, waitFor } from "@testing-library/react";
import RichTextDisplay from "./RichTextDisplay";

const withTaskList = "- [ ] first item\n- [x] second item\n";

describe("RichTextDisplay task list checkboxes", () => {
    it("toggles the item and emits updated markdown when onChange is given", async () => {
        const onChange = vi.fn();
        const { container } = render(
            <RichTextDisplay content={withTaskList} onChange={onChange} />,
        );

        const boxes = await waitFor(() => {
            const found = container.querySelectorAll<HTMLInputElement>(
                'ul[data-type="taskList"] input[type="checkbox"]',
            );
            expect(found).toHaveLength(2);
            return found;
        });

        expect(boxes[0].checked).toBe(false);
        expect(boxes[1].checked).toBe(true);

        fireEvent.click(boxes[0]);

        await waitFor(() => expect(onChange).toHaveBeenCalledTimes(1));
        const md: string = onChange.mock.calls[0][0];
        expect(md).toContain("[x] first item");
        expect(md).toContain("[x] second item");

        // The DOM checkbox reflects the document state.
        const after = container.querySelectorAll<HTMLInputElement>(
            'ul[data-type="taskList"] input[type="checkbox"]',
        );
        expect(after[0].checked).toBe(true);
        expect(after[0].closest("li")?.getAttribute("data-checked")).toBe(
            "true",
        );
    });

    it("keeps checkboxes inert without onChange", async () => {
        const { container } = render(
            <RichTextDisplay content={withTaskList} />,
        );

        const box = await waitFor(() => {
            const found = container.querySelector<HTMLInputElement>(
                'ul[data-type="taskList"] input[type="checkbox"]',
            );
            expect(found).not.toBeNull();
            return found as HTMLInputElement;
        });

        fireEvent.click(box);

        await waitFor(() => expect(box.checked).toBe(false));
    });
});
