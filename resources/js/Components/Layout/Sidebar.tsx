import { Link, router, usePage } from "@inertiajs/react";
import AdminPanelSettingsIcon from "@mui/icons-material/AdminPanelSettings";
import AssignmentIcon from "@mui/icons-material/Assignment";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import GroupsIcon from "@mui/icons-material/Groups";
import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import MenuItem from "@mui/material/MenuItem";
import Toolbar from "@mui/material/Toolbar";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import type { PageProps } from "@/types";
import { useSidebar } from "@/Contexts/SidebarContext";
import Logo from "@/Components/Common/Logo";
import BoardList from "./BoardList";
import TeamSelector from "./TeamSelector";

interface SidebarProps {
    activeBoardId?: string;
    forceExpanded?: boolean;
}

export default function Sidebar({
    activeBoardId,
    forceExpanded,
}: SidebarProps) {
    const { auth } = usePage<PageProps>().props;
    const { collapsed, setCollapsed, currentTeam, boards } = useSidebar();
    const isCollapsed = forceExpanded ? false : collapsed;

    return (
        <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
            {/* Logo */}
            <Toolbar
                sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: isCollapsed ? "center" : "center",
                    px: isCollapsed ? 0 : 2,
                    minHeight: 64,
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
                    <Logo size="small" showText={!isCollapsed} />
                </Link>
            </Toolbar>

            <Divider />

            {/* Navigation links */}
            <Box component="nav" aria-label="Main navigation" sx={{ pt: 1 }}>
                {isCollapsed ? (
                    <>
                        <Tooltip title="My Tasks" placement="right">
                            <MenuItem
                                component={Link}
                                href={route("dashboard")}
                                selected={route().current("dashboard")}
                                aria-current={
                                    route().current("dashboard")
                                        ? "page"
                                        : undefined
                                }
                                sx={{
                                    py: 1.5,
                                    px: 0,
                                    justifyContent: "center",
                                }}
                            >
                                <AssignmentIcon fontSize="small" />
                            </MenuItem>
                        </Tooltip>
                        <Tooltip title="Teams" placement="right">
                            <MenuItem
                                component={Link}
                                href={route("teams.index")}
                                selected={route().current("teams.index")}
                                aria-current={
                                    route().current("teams.index")
                                        ? "page"
                                        : undefined
                                }
                                sx={{
                                    py: 1.5,
                                    px: 0,
                                    justifyContent: "center",
                                }}
                            >
                                <GroupsIcon fontSize="small" />
                            </MenuItem>
                        </Tooltip>
                        {auth.user.is_admin && (
                            <Tooltip title="Admin" placement="right">
                                <MenuItem
                                    component={Link}
                                    href={route("admin.dashboard")}
                                    selected={route().current("admin.*")}
                                    aria-current={
                                        route().current("admin.*")
                                            ? "page"
                                            : undefined
                                    }
                                    sx={{
                                        py: 1.5,
                                        px: 0,
                                        justifyContent: "center",
                                    }}
                                >
                                    <AdminPanelSettingsIcon fontSize="small" />
                                </MenuItem>
                            </Tooltip>
                        )}
                    </>
                ) : (
                    <>
                        <MenuItem
                            component={Link}
                            href={route("dashboard")}
                            selected={route().current("dashboard")}
                            aria-current={
                                route().current("dashboard")
                                    ? "page"
                                    : undefined
                            }
                            sx={{ py: 1.5, px: 2 }}
                        >
                            <ListItemIcon>
                                <AssignmentIcon fontSize="small" />
                            </ListItemIcon>
                            <ListItemText primary="My Tasks" />
                        </MenuItem>

                        <MenuItem
                            component={Link}
                            href={route("teams.index")}
                            selected={route().current("teams.index")}
                            aria-current={
                                route().current("teams.index")
                                    ? "page"
                                    : undefined
                            }
                            sx={{ py: 1.5, px: 2 }}
                        >
                            <ListItemIcon>
                                <GroupsIcon fontSize="small" />
                            </ListItemIcon>
                            <ListItemText primary="Teams" />
                        </MenuItem>

                        {auth.user.is_admin && (
                            <MenuItem
                                component={Link}
                                href={route("admin.dashboard")}
                                selected={route().current("admin.*")}
                                aria-current={
                                    route().current("admin.*")
                                        ? "page"
                                        : undefined
                                }
                                sx={{ py: 1.5, px: 2 }}
                            >
                                <ListItemIcon>
                                    <AdminPanelSettingsIcon fontSize="small" />
                                </ListItemIcon>
                                <ListItemText primary="Admin" />
                            </MenuItem>
                        )}
                    </>
                )}
            </Box>

            <Divider sx={{ my: 1.5 }} />

            {/* Team selector */}
            <TeamSelector collapsed={isCollapsed} />

            {/* Board list */}
            {currentTeam && !isCollapsed && (
                <BoardList
                    boards={boards}
                    teamId={currentTeam.id}
                    activeBoardId={activeBoardId}
                />
            )}

            {/* Collapsed board list — inline initials with tooltips */}
            {currentTeam && isCollapsed && boards.length > 0 && (
                <Box
                    sx={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: 1.5,
                        mt: 1,
                    }}
                >
                    {boards.map((board) => {
                        const isActive = board.id === activeBoardId;
                        const words = board.name.trim().split(/\s+/);
                        const initials =
                            words.length >= 2
                                ? (words[0][0] + words[1][0]).toUpperCase()
                                : board.name.slice(0, 2).toUpperCase();
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
                                                currentTeam.id,
                                                board.id,
                                            ]),
                                        )
                                    }
                                    sx={{
                                        width: 32,
                                        height: 32,
                                        borderRadius: "8px",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        cursor: "pointer",
                                        fontSize: "0.7rem",
                                        fontWeight: 600,
                                        overflow: "hidden",
                                        bgcolor: isActive
                                            ? "primary.main"
                                            : "action.hover",
                                        color: isActive
                                            ? "primary.contrastText"
                                            : "text.secondary",
                                        transition: "all 0.15s",
                                        "&:hover": {
                                            bgcolor: isActive
                                                ? "primary.dark"
                                                : "action.selected",
                                        },
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

            <Box sx={{ flex: 1 }} />

            {/* Collapse toggle — only on desktop (not in forceExpanded mobile drawer) */}
            {!forceExpanded && (
                <>
                    <Divider />
                    <Box
                        sx={{
                            display: "flex",
                            justifyContent: isCollapsed ? "center" : "flex-end",
                            p: 0.5,
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
                    </Box>
                </>
            )}
        </Box>
    );
}
