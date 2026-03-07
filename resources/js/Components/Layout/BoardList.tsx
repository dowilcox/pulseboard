import { useSidebar } from '@/Contexts/SidebarContext';
import type { Board } from '@/types';
import {
    closestCenter,
    DndContext,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
} from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    useSortable,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { router } from '@inertiajs/react';
import DashboardIcon from '@mui/icons-material/Dashboard';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import Box from '@mui/material/Box';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Typography from '@mui/material/Typography';
import { useCallback } from 'react';

interface BoardListProps {
    boards: Board[];
    teamId: string;
    activeBoardId?: string;
}

interface SortableBoardItemProps {
    board: Board;
    teamId: string;
    isActive: boolean;
}

function SortableBoardItem({ board, teamId, isActive }: SortableBoardItemProps) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: board.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
    };

    const handleBoardClick = () => {
        router.get(route('teams.boards.show', [teamId, board.id]));
    };

    return (
        <ListItem ref={setNodeRef} style={style} disablePadding>
            <ListItemButton
                selected={isActive}
                onClick={handleBoardClick}
                sx={{
                    px: 2,
                    py: 1,
                    '&.Mui-selected': {
                        bgcolor: 'action.selected',
                        '&:hover': {
                            bgcolor: 'action.selected',
                        },
                    },
                    '& .drag-handle': {
                        opacity: 0,
                        transition: 'opacity 0.15s',
                    },
                    '&:hover .drag-handle': {
                        opacity: 0.6,
                    },
                }}
            >
                <Box
                    className="drag-handle"
                    {...attributes}
                    {...listeners}
                    sx={{
                        display: 'flex',
                        alignItems: 'center',
                        mr: 0.5,
                        cursor: 'grab',
                        color: 'text.secondary',
                        '&:active': { cursor: 'grabbing' },
                    }}
                    onClick={(e) => e.stopPropagation()}
                    aria-label={`Drag to reorder ${board.name}`}
                    role="button"
                    tabIndex={0}
                >
                    <DragIndicatorIcon sx={{ fontSize: 16 }} />
                </Box>
                <ListItemIcon sx={{ minWidth: 32 }}>
                    <DashboardIcon
                        fontSize="small"
                        color={isActive ? 'primary' : 'action'}
                    />
                </ListItemIcon>
                <ListItemText
                    primary={board.name}
                    primaryTypographyProps={{
                        variant: 'body2',
                        noWrap: true,
                        fontWeight: isActive ? 600 : 400,
                    }}
                />
            </ListItemButton>
        </ListItem>
    );
}

export default function BoardList({ boards, teamId, activeBoardId }: BoardListProps) {
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
            reorderBoards(teamId, reordered.map((b) => b.id));
        },
        [boards, teamId, reorderBoards],
    );

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
            <Box sx={{ px: 2, py: 0.75 }}>
                <Typography
                    variant="overline"
                    color="text.secondary"
                    sx={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.1em' }}
                >
                    Boards
                </Typography>
            </Box>

            {boards.length === 0 ? (
                <Box sx={{ px: 2, py: 1 }}>
                    <Typography variant="body2" color="text.secondary">
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
                                    teamId={teamId}
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
