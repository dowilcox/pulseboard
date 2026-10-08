import { useSidebar } from "@/Contexts/SidebarContext";
import type { Board, Team } from "@/types";
import {
    closestCenter,
    DndContext,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
} from "@dnd-kit/core";
import type { DragEndEvent, Modifier } from "@dnd-kit/core";
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    useSortable,
    verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import List from "@mui/material/List";
import { useCallback } from "react";
import SidebarBoardRow from "./SidebarBoardRow";

// Rows only move vertically inside the narrow sidebar.
const restrictToVerticalAxis: Modifier = ({ transform }) => ({
    ...transform,
    x: 0,
});

interface BoardListProps {
    team: Team;
    boards: Board[];
    activeBoardId?: string;
    id?: string;
    "aria-labelledby"?: string;
}

interface SortableBoardItemProps {
    board: Board;
    team: Team;
    isActive: boolean;
    starred: boolean;
    onToggleStar: (boardId: string) => void;
}

function SortableBoardItem({
    board,
    team,
    isActive,
    starred,
    onToggleStar,
}: SortableBoardItemProps) {
    const {
        attributes,
        listeners,
        setNodeRef,
        setActivatorNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: board.id });

    return (
        <SidebarBoardRow
            board={board}
            team={team}
            isActive={isActive}
            starred={starred}
            onToggleStar={onToggleStar}
            sortable={{
                setNodeRef,
                setActivatorNodeRef,
                attributes,
                listeners,
                isDragging,
                style: {
                    transform: CSS.Translate.toString(transform),
                    transition,
                },
            }}
        />
    );
}

/** One team's boards, reorderable via each row's drag handle. */
export default function BoardList({
    team,
    boards,
    activeBoardId,
    id,
    "aria-labelledby": ariaLabelledBy,
}: BoardListProps) {
    const { reorderBoards, starredBoardIds, toggleStarredBoard } = useSidebar();

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: { distance: 4 },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        }),
    );

    const handleDragEnd = useCallback(
        (event: DragEndEvent) => {
            const { active, over } = event;
            if (!over || active.id === over.id) return;

            const oldIndex = boards.findIndex((b) => b.id === active.id);
            const newIndex = boards.findIndex((b) => b.id === over.id);
            if (oldIndex === -1 || newIndex === -1) return;

            const reordered = arrayMove(boards, oldIndex, newIndex);
            reorderBoards(
                team.id,
                reordered.map((b) => b.id),
            );
        },
        [boards, team.id, reorderBoards],
    );

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            modifiers={[restrictToVerticalAxis]}
            onDragEnd={handleDragEnd}
        >
            <SortableContext
                items={boards.map((b) => b.id)}
                strategy={verticalListSortingStrategy}
            >
                <List
                    dense
                    disablePadding
                    id={id}
                    aria-labelledby={ariaLabelledBy}
                >
                    {boards.map((board) => (
                        <SortableBoardItem
                            key={board.id}
                            board={board}
                            team={team}
                            isActive={board.id === activeBoardId}
                            starred={starredBoardIds.includes(board.id)}
                            onToggleStar={toggleStarredBoard}
                        />
                    ))}
                </List>
            </SortableContext>
        </DndContext>
    );
}
