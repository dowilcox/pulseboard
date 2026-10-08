import { Link } from "@inertiajs/react";
import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";
import Tooltip from "@mui/material/Tooltip";
import type { ReactNode } from "react";
import type { Board, Team } from "@/types";
import { useSidebar } from "@/Contexts/SidebarContext";
import { harbor, harborHex } from "@/theme/harbor";
import { nameInitials, type BoardRef } from "@/utils/sidebarNav";
import {
    SIDEBAR_DIVIDER,
    SIDEBAR_HOVER,
    SIDEBAR_SELECTED,
    SIDEBAR_TEXT,
    TeamAvatar,
} from "./SidebarShared";

interface RailLinkProps {
    href: string;
    label: string;
    active?: boolean;
    size?: number;
    children: ReactNode;
}

/** A focusable icon-only link with a tooltip and an explicit label. */
function RailLink({
    href,
    label,
    active = false,
    size = 36,
    children,
}: RailLinkProps) {
    return (
        <Tooltip title={label} placement="right">
            <Box
                component={Link}
                href={href}
                aria-label={label}
                aria-current={active ? "page" : undefined}
                sx={{
                    width: size,
                    height: size,
                    display: "grid",
                    placeItems: "center",
                    flexShrink: 0,
                    overflow: "hidden",
                    borderRadius: `${harbor.radius.tile}px`,
                    textDecoration: "none",
                    fontSize: "0.72rem",
                    fontWeight: 800,
                    bgcolor: active ? SIDEBAR_SELECTED : SIDEBAR_HOVER,
                    color: active ? SIDEBAR_TEXT : harbor.sub,
                    boxShadow: active
                        ? `${harbor.chipShadow}, 0 0 0 2px ${harborHex.accent}`
                        : "none",
                    "&:hover": {
                        color: SIDEBAR_TEXT,
                        bgcolor: active
                            ? SIDEBAR_SELECTED
                            : "rgba(34, 41, 53, 0.1)",
                    },
                }}
            >
                {children}
            </Box>
        </Tooltip>
    );
}

function BoardTile({
    board,
    team,
    active,
    showTeamName,
}: {
    board: Board;
    team: Team;
    active: boolean;
    showTeamName: boolean;
}) {
    return (
        <Box component="li" sx={{ listStyle: "none" }}>
            <RailLink
                href={route("teams.boards.show", [team.slug, board.slug])}
                label={
                    showTeamName ? `${board.name} (${team.name})` : board.name
                }
                active={active}
            >
                {board.image_url ? (
                    <Box
                        component="img"
                        src={board.image_url}
                        alt=""
                        sx={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                        }}
                    />
                ) : (
                    nameInitials(board.name)
                )}
            </RailLink>
        </Box>
    );
}

const RAIL_LIST_SX = {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 1,
    m: 0,
    p: 0,
} as const;

interface SidebarRailProps {
    starred: BoardRef[];
    activeBoardId?: string;
}

/**
 * Collapsed sidebar content: starred boards, team avatars, and the current
 * team's boards as tiles. Every tile is a link with a tooltip and label.
 */
export default function SidebarRail({
    starred,
    activeBoardId,
}: SidebarRailProps) {
    const { teams, currentTeam } = useSidebar();
    const showTeamNames = teams.length > 1;

    return (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
            {starred.length > 0 && (
                <>
                    <Divider sx={{ mx: 1.5, borderColor: SIDEBAR_DIVIDER }} />
                    <Box
                        component="ul"
                        aria-label="Starred boards"
                        sx={RAIL_LIST_SX}
                    >
                        {starred.map(({ board, team }) => (
                            <BoardTile
                                key={board.id}
                                board={board}
                                team={team}
                                active={board.id === activeBoardId}
                                showTeamName={showTeamNames}
                            />
                        ))}
                    </Box>
                </>
            )}

            {teams.length > 0 && (
                <>
                    <Divider sx={{ mx: 1.5, borderColor: SIDEBAR_DIVIDER }} />
                    <Box component="ul" aria-label="Teams" sx={RAIL_LIST_SX}>
                        {teams.map((team) => {
                            const isCurrent = team.id === currentTeam?.id;
                            const boards = team.boards ?? [];
                            return (
                                <Box
                                    component="li"
                                    key={team.id}
                                    sx={{
                                        listStyle: "none",
                                        display: "flex",
                                        flexDirection: "column",
                                        alignItems: "center",
                                        gap: 1,
                                    }}
                                >
                                    <RailLink
                                        href={route("teams.show", team.slug)}
                                        label={team.name}
                                        active={
                                            isCurrent &&
                                            route().current("teams.show")
                                        }
                                    >
                                        <TeamAvatar team={team} size={36} />
                                    </RailLink>
                                    {isCurrent && boards.length > 0 && (
                                        <Box
                                            component="ul"
                                            aria-label={`${team.name} boards`}
                                            sx={{ ...RAIL_LIST_SX, mb: 0.5 }}
                                        >
                                            {boards.map((board) => (
                                                <BoardTile
                                                    key={board.id}
                                                    board={board}
                                                    team={team}
                                                    active={
                                                        board.id ===
                                                        activeBoardId
                                                    }
                                                    showTeamName={false}
                                                />
                                            ))}
                                        </Box>
                                    )}
                                </Box>
                            );
                        })}
                    </Box>
                </>
            )}
        </Box>
    );
}
