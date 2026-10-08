import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import ViewModuleOutlinedIcon from "@mui/icons-material/ViewModuleOutlined";
import { useCallback, useRef, useState } from "react";
import type { Board, Team } from "@/types";
import { harbor, harborAvatarColor, harborHex } from "@/theme/harbor";
import { nameInitials } from "@/utils/sidebarNav";

// Harbor: the sidebar sits directly on the canvas — active items become
// cream card tiles with a soft chip shadow instead of accent strips.
export const SIDEBAR_BG = harbor.canvas;
export const SIDEBAR_TEXT = harbor.ink;
export const SIDEBAR_MUTED = harbor.faint;
export const SIDEBAR_SELECTED = harbor.card;
export const SIDEBAR_HOVER = "rgba(34, 41, 53, 0.05)";
export const SIDEBAR_DIVIDER = "rgba(34, 41, 53, 0.08)";
export const SIDEBAR_STAR = harborHex.secondary;

/** Focus ring drawn inside the element so the drawer edge can't clip it. */
export const INSET_FOCUS = {
    "&:focus-visible, &.Mui-focusVisible": {
        outline: `2px solid ${harborHex.accent}`,
        outlineOffset: -2,
    },
} as const;

export const VISUALLY_HIDDEN = {
    position: "absolute",
    width: "1px",
    height: "1px",
    p: 0,
    m: "-1px",
    overflow: "hidden",
    clip: "rect(0 0 0 0)",
    whiteSpace: "nowrap",
    border: 0,
} as const;

/**
 * Controlled tooltip props that only open when the measured text element
 * is actually truncated, so short names don't get redundant tooltips.
 */
export function useOverflowTooltip<T extends HTMLElement>() {
    const textRef = useRef<T | null>(null);
    const [open, setOpen] = useState(false);
    const onOpen = useCallback(() => {
        const el = textRef.current;
        if (el && el.scrollWidth > el.clientWidth + 1) setOpen(true);
    }, []);
    const onClose = useCallback(() => setOpen(false), []);
    return { textRef, tooltipProps: { open, onOpen, onClose } };
}

/** Overline label above a sidebar section; `id` labels the list below. */
export function SidebarSectionLabel({
    id,
    children,
}: {
    id: string;
    children: string;
}) {
    return (
        <Typography
            id={id}
            variant="overline"
            component="div"
            sx={{
                display: "block",
                px: 2.5,
                pt: 1.5,
                pb: 0.25,
                fontSize: "0.7rem",
                fontWeight: 800,
                letterSpacing: "0.08em",
                lineHeight: 1.6,
                color: SIDEBAR_MUTED,
            }}
        >
            {children}
        </Typography>
    );
}

/** Board image, or a neutral board icon when there is none. */
export function BoardGlyph({
    board,
    isActive,
}: {
    board: Board;
    isActive: boolean;
}) {
    if (board.image_url) {
        return (
            <Box
                component="img"
                src={board.image_url}
                alt=""
                sx={{
                    width: 22,
                    height: 22,
                    flexShrink: 0,
                    borderRadius: "5px",
                    objectFit: "cover",
                }}
            />
        );
    }
    return (
        <ViewModuleOutlinedIcon
            aria-hidden
            sx={{
                fontSize: 20,
                flexShrink: 0,
                color: isActive ? "primary.main" : "inherit",
            }}
        />
    );
}

/** Team image or initial avatar (decorative — the team name is adjacent). */
export function TeamAvatar({ team, size = 22 }: { team: Team; size?: number }) {
    return (
        <Avatar
            src={team.image_url ?? undefined}
            alt=""
            variant="rounded"
            sx={{
                width: size,
                height: size,
                flexShrink: 0,
                borderRadius: size >= 30 ? "9px" : "6px",
                fontSize: size >= 30 ? "0.8rem" : "0.68rem",
                fontWeight: 800,
                bgcolor: harborAvatarColor(team.name),
                color: "#ffffff",
            }}
        >
            {nameInitials(team.name, 1)}
        </Avatar>
    );
}
