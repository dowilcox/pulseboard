import { useSidebar } from "@/Contexts/SidebarContext";
import type { Board } from "@/types";
import {
    closestCenter,
    DndContext,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
} from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    useSortable,
    verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { router } from "@inertiajs/react";
import ViewModuleOutlinedIcon from "@mui/icons-material/ViewModuleOutlined";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import Box from "@mui/material/Box";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Typography from "@mui/material/Typography";
import { useCallback, useEffect, useRef } from "react";

const SIDEBAR_TEXT = "#f8fafc";
const SIDEBAR_MUTED = "#a8b3c7";
const SIDEBAR_SELECTED = "rgba(108, 92, 255, 0.30)";
const SIDEBAR_HOVER = "rgba(148, 163, 184, 0.14)";
const SIDEBAR_FOCUS = "rgba(108, 92, 255, 0.38)";

interface BoardListProps {
    boards: Board[];
    teamId: string;
    teamSlug: string;
    activeBoardId?: string;
}

interface SortableBoardItemProps {
    board: Board;
    teamSlug: string;
    isActive: boolean;
}

function SortableBoardItem({
    board,
    teamSlug,
    isActive,
}: SortableBoardItemProps) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: board.id });
    const draggedRef = useRef(false);

    useEffect(() => {
        if (isDragging) {
            draggedRef.current = true;
        }
    }, [isDragging]);

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
    };

    const handleBoardClick = () => {
        if (draggedRef.current) {
            draggedRef.current = false;
            return;
        }

        router.get(route("teams.boards.show", [teamSlug, board.slug]));
    };

    return (
        <ListItem ref={setNodeRef} style={style} disablePadding>
            <ListItemButton
                {...attributes}
                {...listeners}
                selected={isActive}
                onClick={handleBoardClick}
                onPointerDownCapture={() => {
                    draggedRef.current = false;
                }}
                sx={{
                    mx: 1,
                    mb: 0.5,
                    px: 1.75,
                    py: 1,
                    borderRadius: 1.25,
                    borderLeft: isActive ? 3 : 0,
                    borderColor: "primary.main",
                    color: isActive ? SIDEBAR_TEXT : SIDEBAR_MUTED,
                    "&.Mui-selected": {
                        bgcolor: SIDEBAR_SELECTED,
                        color: SIDEBAR_TEXT,
                        "&:hover": {
                            bgcolor: SIDEBAR_FOCUS,
                        },
                    },
                    "&:hover": {
                        bgcolor: SIDEBAR_HOVER,
                        color: SIDEBAR_TEXT,
                    },
                    cursor: isDragging ? "grabbing" : "grab",
                    "& .drag-handle": {
                        opacity: isDragging ? 1 : 0,
                        transition: "opacity 0.15s",
                    },
                    "&:hover .drag-handle": {
                        opacity: 0.6,
                    },
                }}
            >
                <Box
                    className="drag-handle"
                    sx={{
                        display: "flex",
                        alignItems: "center",
                        mr: 0.5,
                        color: SIDEBAR_MUTED,
                    }}
                    onClick={(e) => e.stopPropagation()}
                    aria-label={`Drag to reorder ${board.name}`}
                    aria-hidden="true"
                >
                    <DragIndicatorIcon sx={{ fontSize: 16 }} />
                </Box>
                <ListItemIcon sx={{ minWidth: 32 }}>
                    {board.image_url ? (
                        <Box
                            component="img"
                            src={board.image_url}
                            alt={board.name}
                            sx={{
                                width: 24,
                                height: 24,
                                borderRadius: "4px",
                                objectFit: "cover",
                            }}
                        />
                    ) : (
                        <ViewModuleOutlinedIcon
                            fontSize="small"
                            sx={{
                                color: isActive
                                    ? "primary.light"
                                    : SIDEBAR_MUTED,
                            }}
                        />
                    )}
                </ListItemIcon>
                <ListItemText
                    primary={board.name}
                    primaryTypographyProps={{
                        variant: "body2",
                        noWrap: true,
                        fontWeight: isActive ? 800 : 600,
                    }}
                />
            </ListItemButton>
        </ListItem>
    );
}

export default function BoardList({
    boards,
    teamId,
    teamSlug,
    activeBoardId,
}: BoardListProps) {
    const { reorderBoards } = useSidebar();

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: { distance: 5 },
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
                teamId,
                reordered.map((b) => b.id),
            );
        },
        [boards, teamId, reorderBoards],
    );

    return (
        <Box sx={{ display: "flex", flexDirection: "column" }}>
            {boards.length === 0 ? (
                <Box sx={{ px: 2, py: 1 }}>
                    <Typography variant="body2" color={SIDEBAR_MUTED}>
                        No boards yet
                    </Typography>
                </Box>
            ) : (
                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                >
                    <SortableContext
                        items={boards.map((b) => b.id)}
                        strategy={verticalListSortingStrategy}
                    >
                        <List dense disablePadding>
                            {boards.map((board) => (
                                <SortableBoardItem
                                    key={board.id}
                                    board={board}
                                    teamSlug={teamSlug}
                                    isActive={board.id === activeBoardId}
                                />
                            ))}
                        </List>
                    </SortableContext>
                </DndContext>
            )}
        </Box>
    );
}
