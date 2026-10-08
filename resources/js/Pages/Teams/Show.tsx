import LayoutHeader from "@/Components/Layout/LayoutHeader";
import PageHeader from "@/Components/Layout/PageHeader";
import AuthenticatedLayout from "@/Layouts/AuthenticatedLayout";
import { harbor, harborAvatarColor, harborHex } from "@/theme/harbor";
import type { Board, Team, UserWithTeamPivot } from "@/types";
import { formatTimestamp } from "@/utils/formatTimestamp";
import { Head, Link, router } from "@inertiajs/react";
import RouterLink from "@/Components/Common/RouterLink";
import AddIcon from "@mui/icons-material/Add";
import BrushIcon from "@mui/icons-material/Brush";
import DashboardIcon from "@mui/icons-material/Dashboard";
import DownloadIcon from "@mui/icons-material/Download";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import GitlabIcon from "@mui/icons-material/AccountTree";
import MoreHorizIcon from "@mui/icons-material/MoreHoriz";
import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";
import UnarchiveOutlinedIcon from "@mui/icons-material/UnarchiveOutlined";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import Avatar from "@mui/material/Avatar";
import AvatarGroup from "@mui/material/AvatarGroup";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import ButtonBase from "@mui/material/ButtonBase";
import Card from "@mui/material/Card";
import CardActionArea from "@mui/material/CardActionArea";
import Collapse from "@mui/material/Collapse";
import Grid from "@mui/material/Grid2";
import IconButton from "@mui/material/IconButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import MuiLink from "@mui/material/Link";
import Paper from "@mui/material/Paper";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import axios from "axios";
import { type ReactElement, type ReactNode, useEffect, useState } from "react";
import CreateBoardDialog from "./Show/CreateBoardDialog";

interface TeamBoard extends Board {
    open_tasks_count: number;
    overdue_tasks_count: number;
    completed_tasks_count: number;
    last_activity_at: string | null;
}

interface TeamPageCan {
    createBoard: boolean;
    createFromTemplate: boolean;
    manageTeam: boolean;
    manageIntegrations: boolean;
    restoreBoards: boolean;
    exportCsv: boolean;
}

interface Props {
    team: Team;
    members: UserWithTeamPivot[];
    boards: TeamBoard[];
    archivedBoards: Board[];
    can: TeamPageCan;
}

const plural = (count: number, word: string) =>
    `${count} ${word}${count === 1 ? "" : "s"}`;

export default function TeamsShow({
    team,
    members,
    boards,
    archivedBoards,
    can,
}: Props) {
    const [createOpen, setCreateOpen] = useState(false);
    const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
    const [cycleTime, setCycleTime] = useState<number | null>(null);

    // Average cycle time needs the (heavier) stats endpoint; everything else
    // on this page comes with the initial props.
    useEffect(() => {
        const controller = new AbortController();
        axios
            .get<{ cycle_time: number }>(
                route("teams.dashboard.stats", team.slug),
                { signal: controller.signal },
            )
            .then(({ data }) => setCycleTime(data.cycle_time))
            .catch(() => {});
        return () => controller.abort();
    }, [team.slug]);

    const totals = boards.reduce(
        (acc, b) => ({
            open: acc.open + b.open_tasks_count,
            overdue: acc.overdue + b.overdue_tasks_count,
            completed: acc.completed + b.completed_tasks_count,
        }),
        { open: 0, overdue: 0, completed: 0 },
    );

    const settingsHref = route("teams.settings", team.slug);
    const integrationsHref = route("teams.settings", {
        team: team.slug,
        tab: "integrations",
    });
    const menuOpen = Boolean(menuAnchor);
    const closeMenu = () => setMenuAnchor(null);

    return (
        <>
            <Head title={team.name} />
            <LayoutHeader>
                <PageHeader
                    title={team.name}
                    breadcrumbs={[
                        { label: "Teams", href: route("teams.index") },
                    ]}
                    actions={
                        <>
                            {can.manageTeam && (
                                <Button
                                    component={RouterLink}
                                    href={settingsHref}
                                    variant="outlined"
                                    size="small"
                                    startIcon={<SettingsOutlinedIcon />}
                                >
                                    Team settings
                                </Button>
                            )}
                            {can.createBoard && (
                                <Button
                                    variant="contained"
                                    size="small"
                                    startIcon={<AddIcon />}
                                    onClick={() => setCreateOpen(true)}
                                >
                                    New board
                                </Button>
                            )}
                            <Tooltip title="More team actions">
                                <IconButton
                                    size="small"
                                    aria-label="More team actions"
                                    aria-haspopup="menu"
                                    aria-controls={
                                        menuOpen
                                            ? "team-actions-menu"
                                            : undefined
                                    }
                                    aria-expanded={
                                        menuOpen ? "true" : undefined
                                    }
                                    onClick={(e) =>
                                        setMenuAnchor(e.currentTarget)
                                    }
                                >
                                    <MoreHorizIcon />
                                </IconButton>
                            </Tooltip>
                            <Menu
                                id="team-actions-menu"
                                anchorEl={menuAnchor}
                                open={menuOpen}
                                onClose={closeMenu}
                                anchorOrigin={{
                                    vertical: "bottom",
                                    horizontal: "right",
                                }}
                                transformOrigin={{
                                    vertical: "top",
                                    horizontal: "right",
                                }}
                            >
                                {can.exportCsv && (
                                    <MenuItem
                                        component="a"
                                        href={route(
                                            "teams.export.csv",
                                            team.slug,
                                        )}
                                        onClick={closeMenu}
                                    >
                                        <ListItemIcon>
                                            <DownloadIcon fontSize="small" />
                                        </ListItemIcon>
                                        <ListItemText>
                                            Export tasks (CSV)
                                        </ListItemText>
                                    </MenuItem>
                                )}
                                {can.manageIntegrations && (
                                    <MenuItem
                                        component={RouterLink}
                                        href={integrationsHref}
                                        onClick={closeMenu}
                                    >
                                        <ListItemIcon>
                                            <GitlabIcon fontSize="small" />
                                        </ListItemIcon>
                                        <ListItemText>GitLab</ListItemText>
                                    </MenuItem>
                                )}
                                {can.manageIntegrations && (
                                    <MenuItem
                                        component={RouterLink}
                                        href={integrationsHref}
                                        onClick={closeMenu}
                                    >
                                        <ListItemIcon>
                                            <BrushIcon fontSize="small" />
                                        </ListItemIcon>
                                        <ListItemText>Figma</ListItemText>
                                    </MenuItem>
                                )}
                                {!can.manageTeam && (
                                    <MenuItem
                                        component={RouterLink}
                                        href={settingsHref}
                                        onClick={closeMenu}
                                    >
                                        <ListItemIcon>
                                            <SettingsOutlinedIcon fontSize="small" />
                                        </ListItemIcon>
                                        <ListItemText>
                                            Members &amp; labels
                                        </ListItemText>
                                    </MenuItem>
                                )}
                            </Menu>
                        </>
                    }
                />
            </LayoutHeader>

            <TeamIntro team={team} members={members} />

            {/* Boards */}
            <Box
                component="section"
                aria-labelledby="boards-heading"
                sx={{ mb: 4 }}
            >
                <SectionHeading id="boards-heading">
                    Boards{" "}
                    <Box
                        component="span"
                        sx={{ color: "text.secondary", fontWeight: 600 }}
                    >
                        ({boards.length})
                    </Box>
                </SectionHeading>

                {boards.length === 0 ? (
                    <Paper
                        variant="outlined"
                        sx={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            textAlign: "center",
                            py: 6,
                            px: 2,
                        }}
                    >
                        <DashboardIcon
                            sx={{
                                fontSize: 40,
                                color: "text.secondary",
                                mb: 1.5,
                            }}
                        />
                        <Typography
                            component="p"
                            variant="subtitle1"
                            fontWeight={700}
                        >
                            No boards yet
                        </Typography>
                        <Typography
                            variant="body2"
                            color="text.secondary"
                            sx={{ mt: 0.5, mb: can.createBoard ? 2.5 : 0 }}
                        >
                            {can.createBoard
                                ? "Create your first board to start organizing tasks."
                                : "Boards created by your team will show up here."}
                        </Typography>
                        {can.createBoard && (
                            <Button
                                variant="contained"
                                startIcon={<AddIcon />}
                                onClick={() => setCreateOpen(true)}
                            >
                                New board
                            </Button>
                        )}
                    </Paper>
                ) : (
                    <Grid container spacing={2}>
                        {boards.map((board) => (
                            <Grid
                                size={{ xs: 12, sm: 6, lg: 4 }}
                                key={board.id}
                            >
                                <BoardCard team={team} board={board} />
                            </Grid>
                        ))}
                    </Grid>
                )}
            </Box>

            {/* Overview */}
            {boards.length > 0 && (
                <Box
                    component="section"
                    aria-labelledby="overview-heading"
                    sx={{ mb: 4 }}
                >
                    <SectionHeading id="overview-heading">
                        Overview
                    </SectionHeading>
                    <Paper
                        variant="outlined"
                        component="dl"
                        sx={{
                            m: 0,
                            display: "grid",
                            gridTemplateColumns: {
                                xs: "repeat(2, minmax(0, 1fr))",
                                md: "repeat(4, minmax(0, 1fr))",
                            },
                        }}
                    >
                        <Stat label="Open tasks" value={totals.open} />
                        <Stat
                            label="Overdue"
                            value={totals.overdue}
                            tone={totals.overdue > 0 ? "danger" : undefined}
                        />
                        <Stat label="Completed" value={totals.completed} />
                        <Stat
                            label="Avg cycle time (30 days)"
                            value={
                                cycleTime && cycleTime > 0
                                    ? `${cycleTime} days`
                                    : "—"
                            }
                        />
                    </Paper>
                </Box>
            )}

            {archivedBoards.length > 0 && (
                <ArchivedBoards
                    team={team}
                    boards={archivedBoards}
                    canRestore={can.restoreBoards}
                />
            )}

            {can.createBoard && (
                <CreateBoardDialog
                    open={createOpen}
                    onClose={() => setCreateOpen(false)}
                    team={team}
                    canUseTemplates={can.createFromTemplate}
                />
            )}
        </>
    );
}

function SectionHeading({ id, children }: { id: string; children: ReactNode }) {
    return (
        <Typography
            id={id}
            component="h2"
            variant="subtitle1"
            fontWeight={700}
            sx={{ mb: 1.5, color: harbor.ink }}
        >
            {children}
        </Typography>
    );
}

function TeamIntro({
    team,
    members,
}: {
    team: Team;
    members: UserWithTeamPivot[];
}) {
    const membersHref = route("teams.settings", {
        team: team.slug,
        tab: "members",
    });

    return (
        <Box
            sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                columnGap: 3,
                rowGap: 1.5,
                mb: 3,
            }}
        >
            {team.description ? (
                <Typography
                    variant="body1"
                    color="text.secondary"
                    sx={{ flex: "1 1 320px", maxWidth: 760, minWidth: 0 }}
                >
                    {team.description}
                </Typography>
            ) : (
                <Box sx={{ flex: "1 1 0" }} />
            )}
            <Box
                sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 1.25,
                    flexShrink: 0,
                }}
            >
                <AvatarGroup
                    max={6}
                    slotProps={{
                        surplus: {
                            sx: {
                                bgcolor: harborHex.sub,
                                color: "#fff",
                            },
                        },
                    }}
                    sx={{
                        "& .MuiAvatar-root": {
                            width: 30,
                            height: 30,
                            fontSize: "0.8rem",
                            fontWeight: 700,
                            borderColor: harbor.canvas,
                        },
                    }}
                >
                    {members.map((member) => (
                        <Tooltip key={member.id} title={member.name}>
                            <Avatar
                                src={member.avatar_url}
                                alt={member.name}
                                sx={{
                                    bgcolor: harborAvatarColor(member.name),
                                    color: "#fff",
                                }}
                            >
                                {member.name.charAt(0).toUpperCase()}
                            </Avatar>
                        </Tooltip>
                    ))}
                </AvatarGroup>
                <MuiLink
                    component={RouterLink}
                    href={membersHref}
                    variant="body2"
                    fontWeight={600}
                    underline="hover"
                >
                    {plural(members.length, "member")}
                </MuiLink>
            </Box>
        </Box>
    );
}

function BoardCard({ team, board }: { team: Team; board: TeamBoard }) {
    const lastActivity = board.last_activity_at;

    return (
        <Card variant="outlined" sx={{ height: "100%" }}>
            <CardActionArea
                component={RouterLink}
                href={route("teams.boards.show", [team.slug, board.slug])}
                sx={{
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "stretch",
                    justifyContent: "flex-start",
                    p: 2.25,
                }}
            >
                <Box
                    sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 1.25,
                        mb: 1,
                        minWidth: 0,
                    }}
                >
                    <Avatar
                        src={board.image_url ?? undefined}
                        alt=""
                        variant="rounded"
                        sx={{
                            width: 28,
                            height: 28,
                            fontSize: "0.8rem",
                            fontWeight: 700,
                            bgcolor: harborAvatarColor(board.name),
                            color: "#fff",
                        }}
                    >
                        {board.name.charAt(0).toUpperCase()}
                    </Avatar>
                    <Typography
                        component="h3"
                        variant="subtitle1"
                        fontWeight={700}
                        noWrap
                        sx={{ flex: 1, minWidth: 0, color: harbor.ink }}
                    >
                        {board.name}
                    </Typography>
                </Box>

                <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{
                        mb: 1.5,
                        minHeight: "2.86em",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                        fontStyle: board.description ? undefined : "italic",
                    }}
                >
                    {board.description || "No description"}
                </Typography>

                <Box
                    sx={{
                        mt: "auto",
                        display: "flex",
                        alignItems: "center",
                        flexWrap: "wrap",
                        columnGap: 1.5,
                        rowGap: 0.5,
                        fontSize: "0.8rem",
                        color: "text.secondary",
                    }}
                >
                    <Box component="span" sx={{ fontWeight: 600 }}>
                        {plural(board.open_tasks_count, "open task")}
                    </Box>
                    {board.overdue_tasks_count > 0 && (
                        <Box
                            component="span"
                            sx={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 0.4,
                                fontWeight: 700,
                                color: harbor.dangerText,
                            }}
                        >
                            <WarningAmberIcon
                                sx={{ fontSize: 15 }}
                                aria-hidden
                            />
                            {board.overdue_tasks_count} overdue
                        </Box>
                    )}
                    {lastActivity && (
                        <Box
                            component="time"
                            dateTime={lastActivity}
                            title={new Date(lastActivity).toLocaleString()}
                            sx={{ ml: "auto" }}
                        >
                            Updated {formatTimestamp(lastActivity)}
                        </Box>
                    )}
                </Box>
            </CardActionArea>
        </Card>
    );
}

function Stat({
    label,
    value,
    tone,
}: {
    label: string;
    value: number | string;
    tone?: "danger";
}) {
    return (
        <Box
            sx={{
                px: 2,
                py: 1.5,
                display: "flex",
                flexDirection: "column-reverse",
                borderColor: "divider",
                // Hairlines between cells in both the 2- and 4-column layouts.
                borderStyle: "solid",
                borderWidth: 0,
                "&:nth-of-type(odd)": { borderRightWidth: { xs: 1, md: 0 } },
                "&:nth-of-type(-n+2)": { borderBottomWidth: { xs: 1, md: 0 } },
                "&:not(:last-of-type)": { borderRightWidth: { md: 1 } },
            }}
        >
            <Typography
                component="dt"
                variant="caption"
                color="text.secondary"
                fontWeight={600}
            >
                {label}
            </Typography>
            <Typography
                component="dd"
                variant="h6"
                fontWeight={800}
                sx={{
                    m: 0,
                    lineHeight: 1.3,
                    color: tone === "danger" ? harbor.dangerText : harbor.ink,
                }}
            >
                {value}
            </Typography>
        </Box>
    );
}

function ArchivedBoards({
    team,
    boards,
    canRestore,
}: {
    team: Team;
    boards: Board[];
    canRestore: boolean;
}) {
    const [expanded, setExpanded] = useState(false);
    const [restoringId, setRestoringId] = useState<string | null>(null);

    const restore = (board: Board) => {
        router.post(
            route("teams.boards.unarchive", [team.slug, board.slug]),
            {},
            {
                preserveScroll: true,
                onStart: () => setRestoringId(board.id),
                onFinish: () => setRestoringId(null),
            },
        );
    };

    return (
        <Box component="section" sx={{ mb: 4 }}>
            <Typography component="h2" variant="subtitle1" sx={{ m: 0 }}>
                <ButtonBase
                    onClick={() => setExpanded((v) => !v)}
                    aria-expanded={expanded}
                    aria-controls="archived-boards-panel"
                    sx={{
                        gap: 0.5,
                        px: 0.5,
                        py: 0.25,
                        ml: -0.5,
                        borderRadius: 1,
                        font: "inherit",
                        fontWeight: 700,
                        color: harbor.ink,
                        "&.Mui-focusVisible": {
                            outline: `2px solid ${harborHex.accent}`,
                            outlineOffset: 2,
                        },
                    }}
                >
                    <ExpandMoreIcon
                        fontSize="small"
                        aria-hidden
                        sx={{
                            transition: "transform 150ms ease",
                            transform: expanded
                                ? "rotate(0deg)"
                                : "rotate(-90deg)",
                        }}
                    />
                    Archived boards ({boards.length})
                </ButtonBase>
            </Typography>
            <Collapse in={expanded} id="archived-boards-panel">
                <Paper variant="outlined" sx={{ mt: 1.5 }}>
                    {!canRestore && (
                        <Typography
                            variant="body2"
                            color="text.secondary"
                            sx={{ px: 2, pt: 1.5 }}
                        >
                            Archived boards are hidden from the sidebar. Ask a
                            team owner or admin to restore one.
                        </Typography>
                    )}
                    <Box component="ul" sx={{ listStyle: "none", m: 0, p: 0 }}>
                        {boards.map((board) => (
                            <Box
                                component="li"
                                key={board.id}
                                sx={{
                                    display: "flex",
                                    alignItems: "center",
                                    flexWrap: "wrap",
                                    columnGap: 1.5,
                                    rowGap: 1,
                                    px: 2,
                                    py: 1.25,
                                    borderTop: 1,
                                    borderColor: "divider",
                                    // Without the hint paragraph above, the
                                    // first row needs no separator.
                                    ...(canRestore && {
                                        "&:first-of-type": { borderTop: 0 },
                                    }),
                                }}
                            >
                                <Avatar
                                    src={board.image_url ?? undefined}
                                    alt=""
                                    variant="rounded"
                                    sx={{
                                        width: 28,
                                        height: 28,
                                        fontSize: "0.8rem",
                                        fontWeight: 700,
                                        bgcolor: harborAvatarColor(board.name),
                                        color: "#fff",
                                    }}
                                >
                                    {board.name.charAt(0).toUpperCase()}
                                </Avatar>
                                <Box sx={{ minWidth: 0, flex: "1 1 180px" }}>
                                    <Typography
                                        component="h3"
                                        variant="body2"
                                        fontWeight={700}
                                        noWrap
                                    >
                                        <MuiLink
                                            component={RouterLink}
                                            href={route("teams.boards.show", [
                                                team.slug,
                                                board.slug,
                                            ])}
                                            color="inherit"
                                            underline="hover"
                                        >
                                            {board.name}
                                        </MuiLink>
                                    </Typography>
                                    <Typography
                                        variant="caption"
                                        color="text.secondary"
                                        component="div"
                                        noWrap
                                    >
                                        Last updated{" "}
                                        {formatTimestamp(board.updated_at)}
                                    </Typography>
                                </Box>
                                {canRestore && (
                                    <Button
                                        size="small"
                                        variant="outlined"
                                        startIcon={<UnarchiveOutlinedIcon />}
                                        onClick={() => restore(board)}
                                        disabled={restoringId !== null}
                                        aria-label={`Restore ${board.name}`}
                                        sx={{ ml: "auto" }}
                                    >
                                        {restoringId === board.id
                                            ? "Restoring…"
                                            : "Restore"}
                                    </Button>
                                )}
                            </Box>
                        ))}
                    </Box>
                </Paper>
            </Collapse>
        </Box>
    );
}

TeamsShow.layout = (props: Props) => [
    AuthenticatedLayout,
    { currentTeam: props.team, sidebarBoards: props.boards },
];
