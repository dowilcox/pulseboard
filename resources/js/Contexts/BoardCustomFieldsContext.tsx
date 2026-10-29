import type { BoardCustomField } from "@/types";
import { createContext, useContext, type ReactNode } from "react";

const NO_FIELDS: BoardCustomField[] = [];

const BoardCustomFieldsContext = createContext<BoardCustomField[]>(NO_FIELDS);

/**
 * The current board's custom field definitions, for components deep in the
 * board views (task cards, list rows) without threading a prop through
 * every view.
 */
export function BoardCustomFieldsProvider({
    fields,
    children,
}: {
    fields: BoardCustomField[] | undefined;
    children: ReactNode;
}) {
    return (
        <BoardCustomFieldsContext.Provider value={fields ?? NO_FIELDS}>
            {children}
        </BoardCustomFieldsContext.Provider>
    );
}

export function useBoardCustomFields(): BoardCustomField[] {
    return useContext(BoardCustomFieldsContext);
}
