export interface BoardDraft {
    name: string;
    description: string;
}

export interface TemplateLike {
    name: string;
    description?: string | null;
}

export const EMPTY_DRAFT: BoardDraft = { name: "", description: "" };

/**
 * Suggested board name for a template: templates saved from a board are
 * called "<Board> Template", which makes an odd board name, so the suffix
 * is dropped ("Sprint Template" → "Sprint").
 */
export function boardNameFromTemplate(templateName: string): string {
    const stripped = templateName.replace(/\s+template$/i, "").trim();
    return stripped || templateName.trim();
}

/**
 * Pre-fill the create-board form from a selected template without clobbering
 * anything the user typed. A field is only (re)filled when it is empty or
 * still holds the value we auto-filled earlier; selecting `null` (back to a
 * blank board) clears only the auto-filled values.
 *
 * `autofilled` tracks what we put in each field so a later template switch
 * can tell auto-filled text from typed text.
 */
export function applyTemplateDefaults(
    draft: BoardDraft,
    autofilled: BoardDraft,
    template: TemplateLike | null,
): { draft: BoardDraft; autofilled: BoardDraft } {
    const suggestions: BoardDraft = template
        ? {
              name: boardNameFromTemplate(template.name),
              description: template.description?.trim() ?? "",
          }
        : EMPTY_DRAFT;

    const next: BoardDraft = { ...draft };
    const nextAutofilled: BoardDraft = { ...autofilled };

    (Object.keys(suggestions) as (keyof BoardDraft)[]).forEach((field) => {
        const current = draft[field];
        const untouched =
            current.trim() === "" ||
            (autofilled[field] !== "" && current === autofilled[field]);

        if (untouched) {
            next[field] = suggestions[field];
            nextAutofilled[field] = suggestions[field];
        } else {
            // The user owns this value now; never overwrite it later.
            nextAutofilled[field] = "";
        }
    });

    return { draft: next, autofilled: nextAutofilled };
}
