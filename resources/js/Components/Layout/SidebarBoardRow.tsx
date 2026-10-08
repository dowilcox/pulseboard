import { Link } from "@inertiajs/react";
import type {
    DraggableAttributes,
    DraggableSyntheticListeners,
} from "@dnd-kit/core";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import StarIcon from "@mui/icons-material/Star";
import StarBorderIcon from "@mui/icons-material/StarBorder";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import ListItem from "@mui/material/ListItem";
import ListItemButton from "@mui/material/ListItemButton";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import type { CSSProperties } from "react";
import type { Board, Team } from "@/types";
import { harbor } from "@/theme/harbor";
import {
    BoardGlyph,
    INSET_FOCUS,
    SIDEBAR_HOVER,
    SIDEBAR_MUTED,
    SIDEBAR_SELECTED,
    SIDEBAR_STAR,
    SIDEBAR_TEXT,
    VISUALLY_HIDDEN,
    useOverflowTooltip,
} from "./SidebarShared";

/** dnd-kit wiring for rows inside a sortable team list. */
export interface SidebarRowSortable {
    setNodeRef: (node: HTMLElement | null) => void;
    setActivatorNodeRef: (node: HTMLElement | null) => void;
    attributes: DraggableAttributes;
    listeners: DraggableSyntheticListeners;
    style: CSSProperties;
    isDragging: boolean;
}

interface SidebarBoardRowProps {
    board: Board;
    team: Team;
    isActive: boolean;
    starred: boolean;
    onToggleStar: (boardId: string) => void;
    /** Show the team name after the board (cross-team lists). */
    showTeamName?: boolean;
    /** When present, the row is sortable via a dedicated drag handle. */
    sortable?: SidebarRowSortable;
}

/**
 * A sidebar board entry: the row itself is a plain link (Cmd/middle-click
 * and copy-link work); star and drag-handle buttons sit beside it and show
 * on hover/focus (always when starred, and always on touch devices).
 */
export default function SidebarBoardRow({
    board,
    team,
    isActive,
    starred,
    onToggleStar,
    showTeamName = false,
    sortable,
}: SidebarBoardRowProps) {
    const { textRef, tooltipProps } = useOverflowTooltip<HTMLSpanElement>();
    const href = route("teams.boards.show", [team.slug, board.slug]);

    return (
        <ListItem
            ref={sortable?.setNodeRef}
            style={sortable?.style}
            disablePadding
            sx={{
                mx: 1,
                mb: 0.25,
                width: "auto",
                pr: 0.5,
                gap: 0.25,
                borderRadius: `${harbor.radius.tile}px`,
                color: isActive ? SIDEBAR_TEXT : SIDEBAR_MUTED,
                bgcolor: isActive ? SIDEBAR_SELECTED : "transparent",
                boxShadow: isActive ? harbor.chipShadow : "none",
                opacity: sortable?.isDragging ? 0.5 : 1,
                position: "relative",
                zIndex: sortable?.isDragging ? 1 : "auto",
                "&:hover": {
                    bgcolor: isActive ? SIDEBAR_SELECTED : SIDEBAR_HOVER,
                    color: SIDEBAR_TEXT,
                },
                "& .sidebar-row-action": {
                    opacity: 0,
                    p: 0.5,
                    color: SIDEBAR_MUTED,
                    transition: "opacity 120ms ease",
                    ...INSET_FOCUS,
                },
                "& .sidebar-row-action.is-on": {
                    opacity: 1,
                    color: SIDEBAR_STAR,
                },
                "&:hover .sidebar-row-action, &:focus-within .sidebar-row-action":
                    { opacity: 1 },
                "@media (hover: none)": {
                    "& .sidebar-row-action": { opacity: 1 },
                },
            }}
        >
            <Tooltip
                title={
                    showTeamName ? `${board.name} · ${team.name}` : board.name
                }
                placement="right"
                describeChild
                {...tooltipProps}
            >
                <ListItemButton
                    component={Link}
                    href={href}
                    aria-current={isActive ? "page" : undefined}
                    sx={{
                        flex: 1,
                        minWidth: 0,
                        gap: 1.25,
                        px: 1.25,
                        py: 0.75,
                        borderRadius: `${harbor.radius.tile}px`,
                        color: "inherit",
                        "&:hover": { bgcolor: "transparent" },
                        ...INSET_FOCUS,
                    }}
                >
                    <BoardGlyph board={board} isActive={isActive} />
                    <Typography
                        ref={textRef}
                        component="span"
                        noWrap
                        sx={{
                            flex: 1,
                            minWidth: 0,
                            fontSize: "0.875rem",
                            fontWeight: isActive ? 800 : 600,
                            lineHeight: 1.5,
                        }}
                    >
                        {board.name}
                        {showTeamName && (
                            <Box
                                component="span"
                                sx={{
                                    ml: 0.75,
                                    fontSize: "0.75rem",
                                    fontWeight: 500,
                                    color: SIDEBAR_MUTED,
                                }}
                            >
                                <Box component="span" sx={VISUALLY_HIDDEN}>
                                    in{" "}
                                </Box>
                                {team.name}
                            </Box>
                        )}
                    </Typography>
                </ListItemButton>
            </Tooltip>

            <IconButton
                size="small"
                className={`sidebar-row-action${starred ? " is-on" : ""}`}
                aria-pressed={starred}
                aria-label={`${starred ? "Unstar" : "Star"} ${board.name}`}
                onClick={() => onToggleStar(board.id)}
            >
                {starred ? (
                    <StarIcon sx={{ fontSize: 18 }} />
                ) : (
                    <StarBorderIcon sx={{ fontSize: 18 }} />
                )}
            </IconButton>

            {sortable && (
                <IconButton
                    ref={sortable.setActivatorNodeRef}
                    {...sortable.attributes}
                    {...sortable.listeners}
                    size="small"
                    className="sidebar-row-action"
                    aria-label={`Reorder ${board.name}`}
                    sx={{
                        cursor: sortable.isDragging ? "grabbing" : "grab",
                        touchAction: "none",
                    }}
                >
                    <DragIndicatorIcon sx={{ fontSize: 18 }} />
                </IconButton>
            )}
        </ListItem>
    );
}
