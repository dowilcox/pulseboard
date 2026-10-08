import { harbor, harborAvatarColor } from "@/theme/harbor";
import type { PageProps, Team } from "@/types";
import { getRecentBoardIds } from "@/utils/recentBoards";
import { Link, usePage } from "@inertiajs/react";
import AddIcon from "@mui/icons-material/Add";
import StarIcon from "@mui/icons-material/Star";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import LinearProgress from "@mui/material/LinearProgress";
import MuiLink from "@mui/material/Link";
import Typography from "@mui/material/Typography";
import { useMemo, useState } from "react";
import { boardProgressPercent, orderDashboardBoards } from "./dashboardUtils";
import DashboardSection, {
    EmptyState,
    VISUALLY_HIDDEN,
    focusRingSx,
} from "./DashboardSection";
import type { DashboardBoard } from "./types";

const MAX_BOARDS = 8;

function BoardCard({
    board,
    starred,
}: {
    board: DashboardBoard;
    starred: boolean;
}) {
    const percent = boardProgressPercent(board);
    const href = route("teams.boards.show", [board.team.slug, board.slug]);

    return (
        <Box
            sx={{
                position: "relative",
                height: "100%",
                bgcolor: harbor.countBg,
                borderRadius: "12px",
                p: "14px 16px",
                display: "flex",
                flexDirection: "column",
                gap: 1.1,
                transition: "box-shadow 150ms ease-out",
                "&:hover": { boxShadow: harbor.cardShadowHover },
                "&:focus-within": focusRingSx,
            }}
        >
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
                <Avatar
                    variant="rounded"
                    src={board.image_url ?? undefined}
                    alt=""
                    aria-hidden="true"
                    sx={{
                        width: 30,
                        height: 30,
                        fontSize: 13,
                        fontWeight: 700,
                        borderRadius: "8px",
                        bgcolor: harborAvatarColor(board.name),
                        color: "#fff",
                    }}
                >
                    {board.name.charAt(0).toUpperCase()}
                </Avatar>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography
                        component="h3"
                        noWrap
                        sx={{
                            fontFamily: harbor.headingFont,
                            fontSize: 14.5,
                            fontWeight: 700,
                            color: harbor.ink,
                            lineHeight: 1.3,
                        }}
                    >
                        {/* The link's ::after stretches over the whole card so
                            the card is clickable while the link name stays short. */}
                        <MuiLink
                            component={Link}
                            href={href}
                            underline="none"
                            sx={{
                                color: "inherit",
                                "&::after": {
                                    content: '""',
                                    position: "absolute",
                                    inset: 0,
                                    borderRadius: "12px",
                                },
                                "&:focus-visible": { outline: "none" },
                            }}
                        >
                            {board.name}
                        </MuiLink>
                    </Typography>
                    <Typography
                        noWrap
                        sx={{
                            fontSize: 12,
                            color: harbor.sub,
                            lineHeight: 1.4,
                        }}
                    >
                        <Box component="span" sx={VISUALLY_HIDDEN}>
                            Team:{" "}
                        </Box>
                        {board.team.name}
                    </Typography>
                </Box>
                {starred && (
                    <StarIcon
                        titleAccess="Starred"
                        sx={{
                            fontSize: 18,
                            color: harbor.secondary,
                            flex: "none",
                        }}
                    />
                )}
            </Box>

            <Box
                sx={{
                    display: "flex",
                    alignItems: "baseline",
                    justifyContent: "space-between",
                    gap: 1,
                    mt: "auto",
                }}
            >
                <Typography sx={{ fontSize: 12, color: harbor.sub }}>
                    {board.total_tasks === 0
                        ? "No tasks yet"
                        : `${board.done_tasks} of ${board.total_tasks} done`}
                </Typography>
                {board.total_tasks > 0 && (
                    <Typography
                        component="span"
                        aria-hidden="true"
                        sx={{
                            fontFamily: harbor.headingFont,
                            fontSize: 14,
                            fontWeight: 800,
                            color: harbor.ink,
                        }}
                    >
                        {percent}%
                    </Typography>
                )}
            </Box>
            <LinearProgress
                aria-label={`${board.name} progress`}
                variant="determinate"
                value={percent}
                sx={{
                    height: 6,
                    borderRadius: "3px",
                    bgcolor: harbor.card,
                    "& .MuiLinearProgress-bar": {
                        bgcolor: harbor.accent,
                        borderRadius: "3px",
                    },
                }}
            />
            <Typography sx={{ fontSize: 12, color: harbor.sub }}>
                {board.open_tasks} open
                {" · "}
                <Box
                    component="span"
                    sx={
                        board.my_open_tasks > 0
                            ? { fontWeight: 700, color: harbor.ink }
                            : undefined
                    }
                >
                    {board.my_open_tasks} assigned to you
                </Box>
            </Typography>
        </Box>
    );
}

function NoBoards({ teams }: { teams: Team[] }) {
    return (
        <EmptyState title="Your teams don't have any boards yet">
            Boards hold the columns and tasks your team works on.
            <Box
                sx={{
                    display: "flex",
                    justifyContent: "center",
                    flexWrap: "wrap",
                    gap: 1,
                    mt: 1.5,
                }}
            >
                {teams.slice(0, 3).map((team) => (
                    <Button
                        key={team.id}
                        component={Link}
                        href={route("teams.show", team.slug)}
                        variant="contained"
                        size="small"
                        startIcon={<AddIcon />}
                        sx={{ maxWidth: "100%" }}
                    >
                        <Box
                            component="span"
                            sx={{
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                            }}
                        >
                            Add a board in {team.name}
                        </Box>
                    </Button>
                ))}
            </Box>
        </EmptyState>
    );
}

export default function YourBoards({
    boards,
    teams,
}: {
    boards: DashboardBoard[];
    teams: Team[];
}) {
    const { auth } = usePage<PageProps>().props;
    const starredIds = auth.user.ui_preferences?.starred_boards;
    const [recentIds] = useState(() => getRecentBoardIds());

    const ordered = useMemo(
        () => orderDashboardBoards(boards, starredIds ?? [], recentIds),
        [boards, starredIds, recentIds],
    );
    const starred = useMemo(() => new Set(starredIds ?? []), [starredIds]);
    const visible = ordered.slice(0, MAX_BOARDS);

    return (
        <DashboardSection
            id="your-boards"
            title="Your boards"
            count={boards.length}
            countLabel={`${boards.length} ${boards.length === 1 ? "board" : "boards"}`}
            action={
                <MuiLink
                    component={Link}
                    href={route("teams.index")}
                    underline="hover"
                    sx={{ fontSize: 13, fontWeight: 700 }}
                >
                    All teams
                </MuiLink>
            }
        >
            {boards.length === 0 ? (
                <NoBoards teams={teams} />
            ) : (
                <>
                    <Box
                        component="ul"
                        sx={{
                            listStyle: "none",
                            m: 0,
                            p: 0,
                            display: "grid",
                            gridTemplateColumns:
                                "repeat(auto-fill, minmax(min(100%, 220px), 1fr))",
                            gap: 1.5,
                        }}
                    >
                        {visible.map((board) => (
                            <Box
                                component="li"
                                key={board.id}
                                sx={{ minWidth: 0 }}
                            >
                                <BoardCard
                                    board={board}
                                    starred={starred.has(board.id)}
                                />
                            </Box>
                        ))}
                    </Box>
                    {boards.length > MAX_BOARDS && (
                        <Typography
                            sx={{ fontSize: 12.5, color: harbor.sub, mt: 1.5 }}
                        >
                            Showing {MAX_BOARDS} of {boards.length} boards.{" "}
                            <MuiLink
                                component={Link}
                                href={route("teams.index")}
                                underline="hover"
                                sx={{ fontWeight: 700 }}
                            >
                                Browse all teams
                            </MuiLink>
                        </Typography>
                    )}
                </>
            )}
        </DashboardSection>
    );
}
