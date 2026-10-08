import { describe, expect, it } from "vitest";
import {
    applyTemplateDefaults,
    boardNameFromTemplate,
    EMPTY_DRAFT,
} from "./templateDefaults";

const sprint = { name: "Sprint Template", description: "Two-week sprint" };
const kanban = { name: "Kanban", description: "Simple flow" };

describe("boardNameFromTemplate", () => {
    it("drops a trailing 'Template' suffix", () => {
        expect(boardNameFromTemplate("Sprint Template")).toBe("Sprint");
        expect(boardNameFromTemplate("Release template")).toBe("Release");
    });

    it("keeps names without the suffix", () => {
        expect(boardNameFromTemplate("Kanban")).toBe("Kanban");
    });

    it("keeps a name that is only the word Template", () => {
        expect(boardNameFromTemplate("Template")).toBe("Template");
    });
});

describe("applyTemplateDefaults", () => {
    it("fills empty fields from the template", () => {
        const result = applyTemplateDefaults(EMPTY_DRAFT, EMPTY_DRAFT, sprint);
        expect(result.draft).toEqual({
            name: "Sprint",
            description: "Two-week sprint",
        });
        expect(result.autofilled).toEqual(result.draft);
    });

    it("never overwrites what the user typed", () => {
        const typed = { name: "Q3 Launch", description: "" };
        const result = applyTemplateDefaults(typed, EMPTY_DRAFT, sprint);
        expect(result.draft).toEqual({
            name: "Q3 Launch",
            description: "Two-week sprint",
        });
    });

    it("replaces auto-filled values when switching templates", () => {
        const first = applyTemplateDefaults(EMPTY_DRAFT, EMPTY_DRAFT, sprint);
        const second = applyTemplateDefaults(
            first.draft,
            first.autofilled,
            kanban,
        );
        expect(second.draft).toEqual({
            name: "Kanban",
            description: "Simple flow",
        });
    });

    it("keeps edits made after a template filled the field", () => {
        const first = applyTemplateDefaults(EMPTY_DRAFT, EMPTY_DRAFT, sprint);
        const edited = { ...first.draft, name: "Sprint 42" };
        const second = applyTemplateDefaults(edited, first.autofilled, kanban);
        expect(second.draft.name).toBe("Sprint 42");
        expect(second.draft.description).toBe("Simple flow");
    });

    it("clears only auto-filled values when the template is deselected", () => {
        const first = applyTemplateDefaults(EMPTY_DRAFT, EMPTY_DRAFT, sprint);
        const edited = { ...first.draft, description: "My own words" };
        const cleared = applyTemplateDefaults(edited, first.autofilled, null);
        expect(cleared.draft).toEqual({
            name: "",
            description: "My own words",
        });
        expect(cleared.autofilled).toEqual(EMPTY_DRAFT);
    });

    it("treats a missing template description as empty", () => {
        const result = applyTemplateDefaults(EMPTY_DRAFT, EMPTY_DRAFT, {
            name: "Bare",
        });
        expect(result.draft).toEqual({ name: "Bare", description: "" });
    });
});
