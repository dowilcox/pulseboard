import type { Board, Column } from "@/types";
import { router } from "@inertiajs/react";
import { useMemo, useRef, useState } from "react";
import {
    affectedTaskCount,
    buildColumnsPayload,
    columnsAreDirty,
    removeColumn,
    restoreColumn,
    toColumnFormData,
} from "./columnForm";
import type { ColumnFormData } from "./types";

interface UseBoardColumnsFormOptions {
    /** Columns as last saved on the server (the page's `board.columns`). */
    serverColumns: Column[];
    teamSlug: string;
    boardSlug: string;
}

export function useBoardColumnsForm({
    serverColumns,
    teamSlug,
    boardSlug,
}: UseBoardColumnsFormOptions) {
    const savedColumns = useMemo(
        () => toColumnFormData(serverColumns),
        [serverColumns],
    );
    const [columns, setColumns] = useState<ColumnFormData[]>(savedColumns);
    const [columnErrors, setColumnErrors] = useState<Record<string, string>>(
        {},
    );
    const [savingColumns, setSavingColumns] = useState(false);
    const [expandedColumn, setExpandedColumn] = useState<number | null>(null);
    /** Index of an existing column with tasks awaiting a move/delete choice. */
    const [pendingRemoval, setPendingRemoval] = useState<number | null>(null);
    const savingRef = useRef(false);
    const newKeyRef = useRef(0);

    const handleAddColumn = () => {
        newKeyRef.current += 1;
        setColumns((prev) => [
            ...prev,
            {
                _key: `new-${newKeyRef.current}`,
                name: "",
                color: "#64748b",
                wip_limit: "",
                is_done_column: false,
            },
        ]);
    };

    const handleColumnChange = (
        index: number,
        field: keyof ColumnFormData,
        value: string | number | boolean | "",
    ) => {
        setColumns((prev) =>
            prev.map((col, i) => {
                if (i === index) {
                    return { ...col, [field]: value };
                }
                if (field === "is_done_column" && value === true) {
                    return { ...col, is_done_column: false };
                }
                return col;
            }),
        );
    };

    /**
     * Remove a column. Existing columns that hold (or will receive) tasks
     * ask where those tasks go first; everything else is removed directly.
     * Nothing is persisted until "Save columns".
     */
    const handleRemoveColumn = (index: number) => {
        const column = columns[index];
        if (!column) return;

        if (column.id && affectedTaskCount(columns, index) > 0) {
            setPendingRemoval(index);
            return;
        }

        setExpandedColumn(null);
        setColumns((prev) => removeColumn(prev, index, null));
    };

    const confirmRemoval = (moveTo: string | null) => {
        if (pendingRemoval === null) return;
        const index = pendingRemoval;
        setPendingRemoval(null);
        setExpandedColumn(null);
        setColumns((prev) => removeColumn(prev, index, moveTo));
    };

    const handleRestoreColumn = (index: number) => {
        setColumns((prev) => restoreColumn(prev, index));
    };

    const handleMoveColumn = (index: number, direction: "up" | "down") => {
        setColumns((prev) => {
            const next = [...prev];
            const visibleIndices = next.reduce<number[]>(
                (accumulator, column, currentIndex) => {
                    if (!column._destroy) {
                        accumulator.push(currentIndex);
                    }

                    return accumulator;
                },
                [],
            );
            const visiblePosition = visibleIndices.indexOf(index);
            const swapVisiblePosition =
                direction === "up" ? visiblePosition - 1 : visiblePosition + 1;

            if (
                swapVisiblePosition < 0 ||
                swapVisiblePosition >= visibleIndices.length
            ) {
                return prev;
            }

            const swapIndex = visibleIndices[swapVisiblePosition];
            [next[index], next[swapIndex]] = [next[swapIndex], next[index]];

            return next;
        });
        setExpandedColumn(null);
    };

    const handleSaveColumns = () => {
        if (savingRef.current) return;
        savingRef.current = true;
        setSavingColumns(true);
        setColumnErrors({});

        router.put(
            route("teams.boards.columns.reorder", [teamSlug, boardSlug]),
            { columns: buildColumnsPayload(columns) },
            {
                preserveScroll: true,
                onSuccess: (page) => {
                    // The page keeps its state across the redirect, so adopt
                    // the saved columns (with their new ids and task counts)
                    // or a second save would create new columns again.
                    const board = (page.props as { board?: Board }).board;
                    setColumns(toColumnFormData(board?.columns ?? []));
                    setExpandedColumn(null);
                },
                onError: (errors) => {
                    setColumnErrors(errors as Record<string, string>);
                },
                onFinish: () => {
                    savingRef.current = false;
                    setSavingColumns(false);
                },
            },
        );
    };

    const toggleExpandedColumn = (index: number) => {
        setExpandedColumn((currentColumn) =>
            currentColumn === index ? null : index,
        );
    };

    return {
        columns,
        columnErrors,
        expandedColumn,
        savingColumns,
        pendingRemoval,
        isDirty: columnsAreDirty(columns, savedColumns),
        visibleColumns: columns.filter((column) => !column._destroy),
        handleAddColumn,
        handleColumnChange,
        handleMoveColumn,
        handleRemoveColumn,
        handleRestoreColumn,
        confirmRemoval,
        cancelRemoval: () => setPendingRemoval(null),
        handleSaveColumns,
        toggleExpandedColumn,
    };
}
