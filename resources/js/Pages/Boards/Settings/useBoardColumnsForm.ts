import { router } from "@inertiajs/react";
import { useState } from "react";
import type { ColumnFormData } from "./types";

interface UseBoardColumnsFormOptions {
    initialColumns: ColumnFormData[];
    teamSlug: string;
    boardSlug: string;
}

export function useBoardColumnsForm({
    initialColumns,
    teamSlug,
    boardSlug,
}: UseBoardColumnsFormOptions) {
    const [columns, setColumns] = useState<ColumnFormData[]>(initialColumns);
    const [columnErrors, setColumnErrors] = useState<Record<string, string>>(
        {},
    );
    const [savingColumns, setSavingColumns] = useState(false);
    const [expandedColumn, setExpandedColumn] = useState<number | null>(null);

    const handleAddColumn = () => {
        setColumns((prev) => [
            ...prev,
            {
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

    const handleRemoveColumn = (index: number) => {
        setColumns((prev) => {
            const column = prev[index];

            if (column.id) {
                return prev.map((currentColumn, currentIndex) =>
                    currentIndex === index
                        ? { ...currentColumn, _destroy: true }
                        : currentColumn,
                );
            }

            return prev.filter((_, currentIndex) => currentIndex !== index);
        });
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
    };

    const handleSaveColumns = () => {
        setSavingColumns(true);
        setColumnErrors({});

        const payload = columns.map((column, index) => ({
            id: column.id,
            name: column.name,
            color: column.color,
            wip_limit:
                column.wip_limit === "" ? null : Number(column.wip_limit),
            is_done_column: column.is_done_column,
            sort_order: index,
            _destroy: column._destroy ?? false,
        }));

        router.put(
            route("teams.boards.columns.reorder", [teamSlug, boardSlug]),
            { columns: payload },
            {
                onSuccess: () => setSavingColumns(false),
                onError: (errors) => {
                    setColumnErrors(errors as Record<string, string>);
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
        visibleColumns: columns.filter((column) => !column._destroy),
        handleAddColumn,
        handleColumnChange,
        handleMoveColumn,
        handleRemoveColumn,
        handleSaveColumns,
        toggleExpandedColumn,
    };
}
