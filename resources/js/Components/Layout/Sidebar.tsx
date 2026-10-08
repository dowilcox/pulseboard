import { Link, router, usePage } from "@inertiajs/react";
import AdminPanelSettingsIcon from "@mui/icons-material/AdminPanelSettings";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import DashboardOutlinedIcon from "@mui/icons-material/DashboardOutlined";
import GroupsIcon from "@mui/icons-material/Groups";
import LogoutIcon from "@mui/icons-material/Logout";
import PersonOutlineIcon from "@mui/icons-material/PersonOutline";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import MuiLink from "@mui/material/Link";
import Toolbar from "@mui/material/Toolbar";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { useId, useMemo, type ReactNode } from "react";
import type { PageProps } from "@/types";
import { useSidebar } from "@/Contexts/SidebarContext";
import { harbor, harborAvatarColor } from "@/theme/harbor";
import Logo from "@/Components/Common/Logo";
import {
    buildBoardIndex,
    nameInitials,
    resolveRecentBoards,
    resolveStarredBoards,
    type BoardRef,
} from "@/utils/sidebarNav";
import SidebarBoardRow from "./SidebarBoardRow";
import SidebarRail from "./SidebarRail";
import SidebarTeamSection from "./SidebarTeamSection";
import {
    INSET_FOCUS,
    SIDEBAR_BG,
    SIDEBAR_DIVIDER,
    SIDEBAR_HOVER,
    SIDEBAR_MUTED,
    SIDEBAR_SELECTED,
    SIDEBAR_TEXT,
    SidebarSectionLabel,
} from "./SidebarShared";

interface SidebarProps {
    activeBoardId?: string;
    /** Mobile drawer: always expanded, with the account footer. */
    forceExpanded?: boolean;
}

interface NavItemProps {
    href: string;
    icon: ReactNode;
    label: string;
    selected?: boolean;
    collapsed: boolean;
}

function navItemSx(selected: boolean, collapsed: boolean) {
    return {
        minHeight: 44,
        mx: 1,
        mb: 0.5,
        px: collapsed ? 1 : 1.75,
        justifyContent: collapsed ? "center" : "flex-start",
        borderRadius: `${harbor.radius.tile}px`,
        color: selected ? SIDEBAR_TEXT : SIDEBAR_MUTED,
        bgcolor: selected ? SIDEBAR_SELECTED : "transparent",
        boxShadow: selected ? harbor.chipShadow : "none",
        "&.Mui-selected": {
            bgcolor: SIDEBAR_SELECTED,
            color: SIDEBAR_TEXT,
        },
        "&.Mui-selected:hover, &:hover": {
            bgcolor: selected ? SIDEBAR_SELECTED : SIDEBAR_HOVER,
            color: SIDEBAR_TEXT,
        },
        ...INSET_FOCUS,
    } as const;
}

function NavItem({
    href,
    icon,
    label,
    selected = false,
    collapsed,
}: NavItemProps) {
    const content = (
        <ListItemButton
            component={Link}
            href={href}
            selected={selected}
            aria-current={selected ? "page" : undefined}
            aria-label={collapsed ? label : undefined}
            sx={navItemSx(selected, collapsed)}
        >
            <ListItemIcon
                sx={{
                    minWidth: collapsed ? 0 : 38,
                    color: "inherit",
                    justifyContent: "center",
                }}
            >
                {icon}
            </ListItemIcon>
            {!collapsed && (
                <ListItemText
                    primary={label}
                    primaryTypographyProps={{
                        fontWeight: selected ? 800 : 600,
                        fontSize: "0.95rem",
                    }}
                />
            )}
        </ListItemButton>
    );

    return (
        <Box component="li" sx={{ listStyle: "none" }}>
            {collapsed ? (
                <Tooltip title={label} placement="right">
                    {content}
                </Tooltip>
            ) : (
                content
            )}
        </Box>
    );
}

function BoardRefList({
    refs,
    labelId,
    activeBoardId,
    showTeamNames,
}: {
    refs: BoardRef[];
    labelId: string;
    activeBoardId?: string;
    showTeamNames: boolean;
}) {
    const { starredBoardIds, toggleStarredBoard } = useSidebar();
    return (
        <List dense disablePadding aria-labelledby={labelId}>
            {refs.map(({ board, team }) => (
                <SidebarBoardRow
                    key={board.id}
                    board={board}
                    team={team}
                    isActive={board.id === activeBoardId}
                    starred={starredBoardIds.includes(board.id)}
                    onToggleStar={toggleStarredBoard}
                    showTeamName={showTeamNames}
                />
            ))}
        </List>
    );
}

export default function Sidebar({
    activeBoardId,
    forceExpanded,
}: SidebarProps) {
    const { auth } = usePage<PageProps>().props;
    const user = auth.user;
    const { collapsed, setCollapsed, teams, starredBoardIds, recentBoardIds } =
        useSidebar();
    const isCollapsed = forceExpanded ? false : collapsed;
    const idPrefix = useId();
    const starredLabelId = `${idPrefix}-starred`;
    const recentLabelId = `${idPrefix}-recent`;
    const teamsLabelId = `${idPrefix}-teams`;

    const boardIndex = useMemo(() => buildBoardIndex(teams), [teams]);
    const starred = useMemo(
        () => resolveStarredBoards(starredBoardIds, boardIndex),
        [starredBoardIds, boardIndex],
    );
    // The board you're on is already highlighted in its team section, so
    // Recent only lists the places you might want to jump back to.
    const recent = useMemo(
        () =>
            resolveRecentBoards(
                recentBoardIds.filter((id) => id !== activeBoardId),
                starredBoardIds,
                boardIndex,
            ),
        [recentBoardIds, activeBoardId, starredBoardIds, boardIndex],
    );
    const showTeamNames = teams.length > 1;

    return (
        <Box
            component="nav"
            aria-label="Main navigation"
            sx={{
                display: "flex",
                flexDirection: "column",
                flex: "1 0 auto",
                bgcolor: SIDEBAR_BG,
            }}
        >
            <Toolbar
                sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: isCollapsed ? "center" : "flex-start",
                    px: isCollapsed ? 0 : 2.5,
                    minHeight: 82,
                }}
            >
                <Box
                    component={Link}
                    href={route("dashboard")}
                    aria-label="PulseBoard dashboard"
                    sx={{
                        textDecoration: "none",
                        display: "flex",
                        justifyContent: "center",
                        borderRadius: `${harbor.radius.tile}px`,
                    }}
                >
                    <Logo
                        size="medium"
                        showText={!isCollapsed}
                        textColor={SIDEBAR_TEXT}
                    />
                </Box>
            </Toolbar>

            <Divider sx={{ borderColor: SIDEBAR_DIVIDER }} />

            <List sx={{ pt: 1.5, pb: isCollapsed ? 1 : 0 }}>
                <NavItem
                    href={route("dashboard")}
                    icon={<DashboardOutlinedIcon fontSize="small" />}
                    label="Dashboard"
                    selected={route().current("dashboard")}
                    collapsed={isCollapsed}
                />
            </List>

            {isCollapsed ? (
                <SidebarRail starred={starred} activeBoardId={activeBoardId} />
            ) : (
                <>
                    {starred.length > 0 && (
                        <>
                            <SidebarSectionLabel id={starredLabelId}>
                                Starred
                            </SidebarSectionLabel>
                            <BoardRefList
                                refs={starred}
                                labelId={starredLabelId}
                                activeBoardId={activeBoardId}
                                showTeamNames={showTeamNames}
                            />
                        </>
                    )}

                    {recent.length > 0 && (
                        <>
                            <SidebarSectionLabel id={recentLabelId}>
                                Recent
                            </SidebarSectionLabel>
                            <BoardRefList
                                refs={recent}
                                labelId={recentLabelId}
                                activeBoardId={activeBoardId}
                                showTeamNames={showTeamNames}
                            />
                        </>
                    )}

                    <SidebarSectionLabel id={teamsLabelId}>
                        Teams
                    </SidebarSectionLabel>
                    {teams.length === 0 ? (
                        <Typography
                            variant="body2"
                            sx={{
                                px: 2.5,
                                py: 0.75,
                                fontSize: "0.8125rem",
                                color: SIDEBAR_MUTED,
                            }}
                        >
                            You're not in any teams yet.{" "}
                            <MuiLink
                                component={Link}
                                href={route("teams.index")}
                                underline="hover"
                                sx={{ fontWeight: 700 }}
                            >
                                Create or join a team
                            </MuiLink>
                        </Typography>
                    ) : (
                        <Box
                            component="ul"
                            aria-labelledby={teamsLabelId}
                            sx={{ m: 0, p: 0 }}
                        >
                            {teams.map((team) => (
                                <SidebarTeamSection
                                    key={team.id}
                                    team={team}
                                    activeBoardId={activeBoardId}
                                />
                            ))}
                        </Box>
                    )}
                </>
            )}

            <Divider sx={{ my: 1.5, borderColor: SIDEBAR_DIVIDER }} />

            <List aria-label="Account and administration" sx={{ py: 0 }}>
                <NavItem
                    href={route("teams.index")}
                    icon={<GroupsIcon fontSize="small" />}
                    label="All teams"
                    selected={route().current("teams.index")}
                    collapsed={isCollapsed}
                />
                {!forceExpanded && (
                    <NavItem
                        href={route("profile.edit")}
                        icon={<PersonOutlineIcon fontSize="small" />}
                        label="Profile"
                        selected={route().current("profile.*")}
                        collapsed={isCollapsed}
                    />
                )}
                {user.is_admin && (
                    <NavItem
                        href={route("admin.dashboard")}
                        icon={<AdminPanelSettingsIcon fontSize="small" />}
                        label="Admin"
                        selected={route().current("admin.*")}
                        collapsed={isCollapsed}
                    />
                )}
            </List>

            <Box sx={{ flex: 1, minHeight: 16 }} />

            {forceExpanded ? (
                <>
                    <Divider sx={{ borderColor: SIDEBAR_DIVIDER }} />
                    <Box sx={{ p: 1.5, pb: 2 }}>
                        <Box
                            sx={{
                                display: "flex",
                                alignItems: "center",
                                gap: 1.25,
                                px: 1,
                                pb: 1,
                                minWidth: 0,
                            }}
                        >
                            <Avatar
                                src={user.avatar_url}
                                alt=""
                                sx={{
                                    width: 32,
                                    height: 32,
                                    fontSize: "0.75rem",
                                    fontWeight: 800,
                                    bgcolor: harborAvatarColor(user.name),
                                    color: "#ffffff",
                                }}
                            >
                                {nameInitials(user.name)}
                            </Avatar>
                            <Box sx={{ minWidth: 0 }}>
                                <Typography
                                    noWrap
                                    sx={{
                                        fontWeight: 800,
                                        fontSize: "0.9rem",
                                        color: SIDEBAR_TEXT,
                                    }}
                                >
                                    {user.name}
                                </Typography>
                                <Typography
                                    noWrap
                                    sx={{
                                        fontSize: "0.75rem",
                                        color: SIDEBAR_MUTED,
                                    }}
                                >
                                    {user.email}
                                </Typography>
                            </Box>
                        </Box>
                        <List disablePadding aria-label="Account">
                            <NavItem
                                href={route("profile.edit")}
                                icon={<PersonOutlineIcon fontSize="small" />}
                                label="Profile"
                                selected={route().current("profile.*")}
                                collapsed={false}
                            />
                            <li>
                                <ListItemButton
                                    component="button"
                                    onClick={() => router.post(route("logout"))}
                                    sx={{
                                        ...navItemSx(false, false),
                                        width: "calc(100% - 16px)",
                                        textAlign: "left",
                                    }}
                                >
                                    <ListItemIcon
                                        sx={{
                                            minWidth: 38,
                                            color: "inherit",
                                            justifyContent: "center",
                                        }}
                                    >
                                        <LogoutIcon fontSize="small" />
                                    </ListItemIcon>
                                    <ListItemText
                                        primary="Log out"
                                        primaryTypographyProps={{
                                            fontWeight: 600,
                                            fontSize: "0.95rem",
                                        }}
                                    />
                                </ListItemButton>
                            </li>
                        </List>
                    </Box>
                </>
            ) : (
                <>
                    <Divider sx={{ borderColor: SIDEBAR_DIVIDER }} />
                    <Box
                        sx={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: isCollapsed
                                ? "center"
                                : "flex-start",
                            gap: 1,
                            p: 1.5,
                        }}
                    >
                        <Tooltip
                            title={
                                isCollapsed
                                    ? "Expand sidebar"
                                    : "Collapse sidebar"
                            }
                            placement="right"
                        >
                            <IconButton
                                size="small"
                                onClick={() => setCollapsed(!isCollapsed)}
                                sx={{ color: SIDEBAR_MUTED }}
                                aria-label={
                                    isCollapsed
                                        ? "Expand sidebar"
                                        : "Collapse sidebar"
                                }
                            >
                                {isCollapsed ? (
                                    <ChevronRightIcon fontSize="small" />
                                ) : (
                                    <ChevronLeftIcon fontSize="small" />
                                )}
                            </IconButton>
                        </Tooltip>
                        {!isCollapsed && (
                            <Typography
                                color={SIDEBAR_MUTED}
                                fontWeight={600}
                                aria-hidden
                            >
                                Collapse
                            </Typography>
                        )}
                    </Box>
                </>
            )}
        </Box>
    );
}
