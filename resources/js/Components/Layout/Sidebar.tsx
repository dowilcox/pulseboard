import { Link, router, usePage } from "@inertiajs/react";
import AdminPanelSettingsIcon from "@mui/icons-material/AdminPanelSettings";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import DashboardOutlinedIcon from "@mui/icons-material/DashboardOutlined";
import GroupsIcon from "@mui/icons-material/Groups";
import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";
import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Toolbar from "@mui/material/Toolbar";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import type { PageProps } from "@/types";
import { useSidebar } from "@/Contexts/SidebarContext";
import { harbor } from "@/theme/harbor";
import Logo from "@/Components/Common/Logo";
import BoardList from "./BoardList";
import type { ReactNode } from "react";

// Harbor: the sidebar sits directly on the canvas — active items become
// cream card tiles with a soft chip shadow instead of accent strips.
const SIDEBAR_BG = harbor.canvas;
const SIDEBAR_TEXT = harbor.ink;
const SIDEBAR_MUTED = harbor.faint;
const SIDEBAR_SELECTED = harbor.card;
const SIDEBAR_HOVER = "rgba(34, 41, 53, 0.05)";
const SIDEBAR_DIVIDER = "rgba(34, 41, 53, 0.08)";

interface SidebarProps {
    activeBoardId?: string;
    forceExpanded?: boolean;
}

interface NavItemProps {
    href?: string;
    icon: ReactNode;
    label: string;
    selected?: boolean;
    collapsed: boolean;
    badge?: number;
}

function NavItem({
    href,
    icon,
    label,
    selected = false,
    collapsed,
    badge,
}: NavItemProps) {
    const content = href ? (
        <ListItemButton
            component={Link}
            href={href}
            selected={selected}
            aria-current={selected ? "page" : undefined}
            sx={{
                minHeight: 46,
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
            }}
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
                <>
                    <ListItemText
                        primary={label}
                        primaryTypographyProps={{
                            fontWeight: selected ? 800 : 600,
                            fontSize: "0.95rem",
                        }}
                    />
                    {badge != null && badge > 0 && (
                        <Box
                            sx={{
                                minWidth: 26,
                                height: 26,
                                px: 1,
                                borderRadius: 999,
                                bgcolor: harbor.countBg,
                                color: harbor.sub,
                                display: "grid",
                                placeItems: "center",
                                fontSize: "0.8rem",
                                fontWeight: 800,
                            }}
                        >
                            {badge}
                        </Box>
                    )}
                </>
            )}
        </ListItemButton>
    ) : (
        <ListItemButton
            component="button"
            selected={selected}
            aria-current={selected ? "page" : undefined}
            sx={{
                minHeight: 46,
                mx: 1,
                mb: 0.5,
                px: collapsed ? 1 : 1.75,
                justifyContent: collapsed ? "center" : "flex-start",
                borderRadius: `${harbor.radius.tile}px`,
                color: selected ? SIDEBAR_TEXT : SIDEBAR_MUTED,
                bgcolor: selected ? SIDEBAR_SELECTED : "transparent",
                boxShadow: selected ? harbor.chipShadow : "none",
                width: "calc(100% - 16px)",
                textAlign: "left",
                "&.Mui-selected": {
                    bgcolor: SIDEBAR_SELECTED,
                    color: SIDEBAR_TEXT,
                },
                "&.Mui-selected:hover, &:hover": {
                    bgcolor: selected ? SIDEBAR_SELECTED : SIDEBAR_HOVER,
                    color: SIDEBAR_TEXT,
                },
            }}
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
                <>
                    <ListItemText
                        primary={label}
                        primaryTypographyProps={{
                            fontWeight: selected ? 800 : 600,
                            fontSize: "0.95rem",
                        }}
                    />
                    {badge != null && badge > 0 && (
                        <Box
                            sx={{
                                minWidth: 26,
                                height: 26,
                                px: 1,
                                borderRadius: 999,
                                bgcolor: harbor.countBg,
                                color: harbor.sub,
                                display: "grid",
                                placeItems: "center",
                                fontSize: "0.8rem",
                                fontWeight: 800,
                            }}
                        >
                            {badge}
                        </Box>
                    )}
                </>
            )}
        </ListItemButton>
    );

    if (collapsed) {
        return (
            <Tooltip title={label} placement="right">
                {content}
            </Tooltip>
        );
    }

    return content;
}

export default function Sidebar({
    activeBoardId,
    forceExpanded,
}: SidebarProps) {
    const { auth } = usePage<PageProps>().props;
    const { collapsed, setCollapsed, currentTeam, boards } = useSidebar();
    const isCollapsed = forceExpanded ? false : collapsed;

    const settingsHref = currentTeam
        ? route("teams.settings", currentTeam.slug)
        : route("profile.edit");

    return (
        <Box
            sx={{
                display: "flex",
                flexDirection: "column",
                height: "100%",
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
                <Link
                    href={route("dashboard")}
                    style={{
                        textDecoration: "none",
                        display: "flex",
                        justifyContent: "center",
                    }}
                >
                    <Logo
                        size="medium"
                        showText={!isCollapsed}
                        textColor={SIDEBAR_TEXT}
                    />
                </Link>
            </Toolbar>

            <Divider sx={{ borderColor: SIDEBAR_DIVIDER }} />

            <List component="nav" aria-label="Main navigation" sx={{ py: 1.5 }}>
                <NavItem
                    href={route("dashboard")}
                    icon={<DashboardOutlinedIcon fontSize="small" />}
                    label="Dashboard"
                    selected={route().current("dashboard")}
                    collapsed={isCollapsed}
                />
            </List>

            {!isCollapsed && (
                <Typography
                    variant="overline"
                    sx={{
                        px: 2.5,
                        pb: 0.5,
                        fontSize: "0.7rem",
                        fontWeight: 800,
                        letterSpacing: "0.08em",
                        color: SIDEBAR_MUTED,
                    }}
                >
                    Boards
                </Typography>
            )}

            {currentTeam && !isCollapsed && (
                <BoardList
                    boards={boards}
                    teamId={currentTeam.id}
                    teamSlug={currentTeam.slug}
                    activeBoardId={activeBoardId}
                />
            )}

            {currentTeam && isCollapsed && boards.length > 0 && (
                <Box
                    sx={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: 1.25,
                        mt: 1,
                    }}
                >
                    {boards.map((board) => {
                        const isActive = board.id === activeBoardId;
                        const initials = board.name
                            .trim()
                            .split(/\s+/)
                            .slice(0, 2)
                            .map((word) => word.charAt(0))
                            .join("")
                            .toUpperCase();
                        return (
                            <Tooltip
                                key={board.id}
                                title={board.name}
                                placement="right"
                            >
                                <Box
                                    onClick={() =>
                                        router.get(
                                            route("teams.boards.show", [
                                                currentTeam.slug,
                                                board.slug,
                                            ]),
                                        )
                                    }
                                    sx={{
                                        width: 34,
                                        height: 34,
                                        borderRadius: `${harbor.radius.tile}px`,
                                        display: "grid",
                                        placeItems: "center",
                                        cursor: "pointer",
                                        fontSize: "0.72rem",
                                        fontWeight: 800,
                                        overflow: "hidden",
                                        bgcolor: isActive
                                            ? SIDEBAR_SELECTED
                                            : SIDEBAR_HOVER,
                                        color: isActive
                                            ? SIDEBAR_TEXT
                                            : SIDEBAR_MUTED,
                                        boxShadow: isActive
                                            ? harbor.chipShadow
                                            : "none",
                                    }}
                                >
                                    {board.image_url ? (
                                        <Box
                                            component="img"
                                            src={board.image_url}
                                            alt={board.name}
                                            sx={{
                                                width: "100%",
                                                height: "100%",
                                                objectFit: "cover",
                                            }}
                                        />
                                    ) : (
                                        initials
                                    )}
                                </Box>
                            </Tooltip>
                        );
                    })}
                </Box>
            )}

            <Divider sx={{ my: 1.5, borderColor: SIDEBAR_DIVIDER }} />

            <List
                component="nav"
                aria-label="Secondary navigation"
                sx={{ py: 0 }}
            >
                <NavItem
                    href={route("teams.index")}
                    icon={<GroupsIcon fontSize="small" />}
                    label="Teams"
                    selected={route().current("teams.index")}
                    collapsed={isCollapsed}
                />
                <NavItem
                    href={settingsHref}
                    icon={<SettingsOutlinedIcon fontSize="small" />}
                    label="Settings"
                    selected={
                        route().current("teams.settings") ||
                        route().current("teams.bots.*") ||
                        route().current("teams.figma.*") ||
                        route().current("teams.gitlab-projects.*") ||
                        route().current("profile.*")
                    }
                    collapsed={isCollapsed}
                />
                {auth.user.is_admin && (
                    <NavItem
                        href={route("admin.dashboard")}
                        icon={<AdminPanelSettingsIcon fontSize="small" />}
                        label="Admin"
                        selected={route().current("admin.*")}
                        collapsed={isCollapsed}
                    />
                )}
            </List>

            <Box sx={{ flex: 1 }} />

            {!forceExpanded && (
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
                            <Typography color={SIDEBAR_MUTED} fontWeight={600}>
                                Collapse
                            </Typography>
                        )}
                    </Box>
                </>
            )}
        </Box>
    );
}
