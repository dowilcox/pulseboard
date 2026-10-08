import { Link } from "@inertiajs/react";
import RouterLink from "@/Components/Common/RouterLink";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";
import Box from "@mui/material/Box";
import Collapse from "@mui/material/Collapse";
import IconButton from "@mui/material/IconButton";
import ListItemButton from "@mui/material/ListItemButton";
import MuiLink from "@mui/material/Link";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { useId } from "react";
import type { Team } from "@/types";
import { useSidebar } from "@/Contexts/SidebarContext";
import { harbor } from "@/theme/harbor";
import BoardList from "./BoardList";
import {
    INSET_FOCUS,
    SIDEBAR_HOVER,
    SIDEBAR_MUTED,
    SIDEBAR_SELECTED,
    SIDEBAR_TEXT,
    TeamAvatar,
    useOverflowTooltip,
} from "./SidebarShared";

interface SidebarTeamSectionProps {
    team: Team;
    activeBoardId?: string;
}

/**
 * One collapsible team group: the header links to the team page, a toggle
 * shows/hides its boards, and owners/admins get a settings shortcut.
 */
export default function SidebarTeamSection({
    team,
    activeBoardId,
}: SidebarTeamSectionProps) {
    const { currentTeam, isTeamExpanded, setTeamExpanded } = useSidebar();
    const { textRef, tooltipProps } = useOverflowTooltip<HTMLSpanElement>();
    const listId = useId();
    const nameId = useId();

    const expanded = isTeamExpanded(team.id);
    const boards = team.boards ?? [];
    const role = team.pivot?.role;
    const canManage = role === "owner" || role === "admin";
    const isCurrentTeam = currentTeam?.id === team.id;
    const isTeamPage = isCurrentTeam && route().current("teams.show");
    const isSettingsPage = isCurrentTeam && route().current("teams.settings");

    return (
        <Box component="li" sx={{ listStyle: "none", mb: 0.5 }}>
            <Box
                sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 0.25,
                    mx: 1,
                    pr: 0.5,
                    borderRadius: `${harbor.radius.tile}px`,
                    color: isCurrentTeam ? SIDEBAR_TEXT : SIDEBAR_MUTED,
                    bgcolor: isTeamPage ? SIDEBAR_SELECTED : "transparent",
                    boxShadow: isTeamPage ? harbor.chipShadow : "none",
                    "&:hover": {
                        bgcolor: isTeamPage ? SIDEBAR_SELECTED : SIDEBAR_HOVER,
                        color: SIDEBAR_TEXT,
                    },
                    "& .sidebar-row-action": {
                        opacity: isSettingsPage ? 1 : 0,
                        transition: "opacity 120ms ease",
                    },
                    "&:hover .sidebar-row-action, &:focus-within .sidebar-row-action":
                        { opacity: 1 },
                    "@media (hover: none)": {
                        "& .sidebar-row-action": { opacity: 1 },
                    },
                    "& .MuiIconButton-root": {
                        p: 0.5,
                        color: SIDEBAR_MUTED,
                        ...INSET_FOCUS,
                    },
                }}
            >
                <Tooltip
                    title={team.name}
                    placement="right"
                    describeChild
                    {...tooltipProps}
                >
                    <ListItemButton
                        component={RouterLink}
                        href={route("teams.show", team.slug)}
                        aria-current={isTeamPage ? "page" : undefined}
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
                        <TeamAvatar team={team} />
                        <Typography
                            id={nameId}
                            ref={textRef}
                            component="span"
                            noWrap
                            sx={{
                                flex: 1,
                                minWidth: 0,
                                fontSize: "0.875rem",
                                fontWeight: 800,
                                lineHeight: 1.5,
                            }}
                        >
                            {team.name}
                        </Typography>
                    </ListItemButton>
                </Tooltip>

                {canManage && (
                    <Tooltip title="Team settings" placement="top">
                        <IconButton
                            component={RouterLink}
                            href={route("teams.settings", team.slug)}
                            size="small"
                            className="sidebar-row-action"
                            aria-label={`${team.name} settings`}
                            aria-current={isSettingsPage ? "page" : undefined}
                        >
                            <SettingsOutlinedIcon sx={{ fontSize: 18 }} />
                        </IconButton>
                    </Tooltip>
                )}

                <Tooltip
                    title={expanded ? "Hide boards" : "Show boards"}
                    placement="top"
                    describeChild
                >
                    <IconButton
                        size="small"
                        aria-expanded={expanded}
                        aria-controls={listId}
                        aria-label={`${team.name} boards`}
                        onClick={() => setTeamExpanded(team.id, !expanded)}
                    >
                        <ExpandMoreIcon
                            sx={{
                                fontSize: 20,
                                transition: "transform 150ms ease",
                                transform: expanded ? "none" : "rotate(-90deg)",
                            }}
                        />
                    </IconButton>
                </Tooltip>
            </Box>

            <Collapse in={expanded} id={listId}>
                {boards.length === 0 ? (
                    <Typography
                        variant="body2"
                        sx={{
                            pl: 5.5,
                            pr: 2,
                            py: 0.75,
                            fontSize: "0.8125rem",
                            color: SIDEBAR_MUTED,
                        }}
                    >
                        No boards yet ·{" "}
                        <MuiLink
                            component={RouterLink}
                            href={route("teams.show", team.slug)}
                            underline="hover"
                            sx={{ fontWeight: 700 }}
                        >
                            Open team
                        </MuiLink>
                    </Typography>
                ) : (
                    <Box sx={{ pt: 0.25, pl: 1.25 }}>
                        <BoardList
                            team={team}
                            boards={boards}
                            activeBoardId={activeBoardId}
                            aria-labelledby={nameId}
                        />
                    </Box>
                )}
            </Collapse>
        </Box>
    );
}
