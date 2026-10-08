import { Link as InertiaLink, usePage } from "@inertiajs/react";
import CheckIcon from "@mui/icons-material/Check";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import GroupsIcon from "@mui/icons-material/Groups";
import MuiBreadcrumbs from "@mui/material/Breadcrumbs";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import Link from "@mui/material/Link";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import { harbor } from "@/theme/harbor";
import { useId, useState, type ReactNode } from "react";
import type { PageProps } from "@/types";
import { useSidebar } from "@/Contexts/SidebarContext";
import { TeamAvatar } from "@/Components/Layout/SidebarShared";

// Harbor breadcrumbs: small bold faint trail with "›" separators; the
// trailing crumb steps up to the sub tone. Every crumb and the separator
// share one inline-flex, centered, single-line-height box so links
// (inline <a>), the current-page <p>, and the "›" all sit on one line.
const CRUMB_SX = {
    fontSize: "12.5px",
    fontWeight: 600,
    lineHeight: 1.5,
    display: "inline-flex",
    alignItems: "center",
    color: harbor.faint,
} as const;

const VISUALLY_HIDDEN = {
    position: "absolute",
    width: "1px",
    height: "1px",
    p: 0,
    m: -1,
    overflow: "hidden",
    clip: "rect(0 0 0 0)",
    whiteSpace: "nowrap",
    border: 0,
};

export interface BreadcrumbItem {
    label: string;
    href?: string;
    /**
     * Render this crumb as a team switcher: clicking it still navigates via
     * `href`, and an adjacent menu lists the user's other teams.
     */
    teamSwitcher?: boolean;
}

/**
 * Team crumb plus a chevron that opens a menu of the user's teams, so
 * switching teams doesn't require a trip through the Teams index.
 */
function TeamSwitcherCrumb({
    crumb,
    color,
}: {
    crumb: BreadcrumbItem;
    color: string;
}) {
    const teams = usePage<PageProps>().props.teams ?? [];
    const { currentTeam } = useSidebar();
    const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
    const open = Boolean(anchorEl);
    const buttonId = useId();
    const menuId = useId();
    const close = () => setAnchorEl(null);

    const isCurrent = (slug: string, id: string) =>
        currentTeam
            ? currentTeam.id === id
            : crumb.href === route("teams.show", slug);

    return (
        <Box
            component="span"
            sx={{ display: "inline-flex", alignItems: "center", minWidth: 0 }}
        >
            {crumb.href ? (
                <Link
                    component={InertiaLink}
                    href={crumb.href}
                    underline="hover"
                    noWrap
                    sx={{ ...CRUMB_SX, display: "block", color }}
                >
                    {crumb.label}
                </Link>
            ) : (
                <Typography
                    noWrap
                    sx={{ ...CRUMB_SX, display: "block", color }}
                >
                    {crumb.label}
                </Typography>
            )}
            <IconButton
                id={buttonId}
                size="small"
                aria-label="Switch team"
                aria-haspopup="menu"
                aria-controls={open ? menuId : undefined}
                aria-expanded={open ? "true" : undefined}
                onClick={(event) => setAnchorEl(event.currentTarget)}
                sx={{ ml: 0.25, p: 0.25, color }}
            >
                <ExpandMoreIcon sx={{ fontSize: 16 }} />
            </IconButton>
            <Menu
                id={menuId}
                anchorEl={anchorEl}
                open={open}
                onClose={close}
                slotProps={{
                    list: { "aria-labelledby": buttonId, dense: true },
                    paper: { sx: { minWidth: 220, maxWidth: 320, mt: 0.5 } },
                }}
            >
                {teams.map((team) => {
                    const current = isCurrent(team.slug, team.id);
                    return (
                        <MenuItem
                            key={team.id}
                            component={InertiaLink}
                            href={route("teams.show", team.slug)}
                            selected={current}
                            aria-current={current ? "true" : undefined}
                            onClick={close}
                        >
                            <ListItemIcon>
                                <TeamAvatar team={team} />
                            </ListItemIcon>
                            <ListItemText
                                primary={team.name}
                                primaryTypographyProps={{
                                    noWrap: true,
                                    fontWeight: current ? 800 : 600,
                                }}
                            />
                            {current && (
                                <CheckIcon
                                    aria-hidden
                                    sx={{ ml: 1, fontSize: 18 }}
                                />
                            )}
                        </MenuItem>
                    );
                })}
                {teams.length > 0 && <Divider />}
                <MenuItem
                    component={InertiaLink}
                    href={route("teams.index")}
                    onClick={close}
                >
                    <ListItemIcon>
                        <GroupsIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText primary="All teams" />
                </MenuItem>
            </Menu>
        </Box>
    );
}

interface PageHeaderProps {
    /** The current page title displayed as h1 */
    title: string;
    /**
     * Ancestor trail, outermost first. The current page title is rendered
     * below, not repeated here. Top-level pages (Dashboard, Teams, Profile)
     * pass none; team-scoped pages start with the team crumb.
     */
    breadcrumbs?: BreadcrumbItem[];
    /** Optional custom title renderer, used for editable page titles. */
    titleContent?: ReactNode;
    /** Optional actions (buttons, etc.) rendered on the right side */
    actions?: ReactNode;
}

export default function PageHeader({
    title,
    breadcrumbs = [],
    titleContent,
    actions,
}: PageHeaderProps) {
    return (
        <Box
            sx={{
                display: "flex",
                alignItems: { xs: "flex-start", md: "center" },
                justifyContent: "space-between",
                width: "100%",
                gap: 2,
                flexDirection: { xs: "column", md: "row" },
            }}
        >
            <Box sx={{ minWidth: 0, flex: "1 1 auto", maxWidth: "100%" }}>
                {breadcrumbs.length > 0 && (
                    <MuiBreadcrumbs
                        separator="›"
                        sx={{
                            mb: 0.25,
                            // Center every crumb's <li> wrapper so the link text,
                            // current-page text, and "›" separators share one
                            // baseline (the wrappers otherwise inherit a taller
                            // line-box than the separators and ride low).
                            "& .MuiBreadcrumbs-ol": { alignItems: "center" },
                            "& .MuiBreadcrumbs-li": {
                                display: "flex",
                                alignItems: "center",
                                minWidth: 0,
                            },
                            "& .MuiBreadcrumbs-separator": {
                                ...CRUMB_SX,
                                mx: 0.75,
                            },
                        }}
                        aria-label="breadcrumb"
                    >
                        {breadcrumbs.map((crumb, index) => {
                            const isLast = index === breadcrumbs.length - 1;
                            const color = isLast ? harbor.sub : harbor.faint;
                            if (crumb.teamSwitcher) {
                                return (
                                    <TeamSwitcherCrumb
                                        key={crumb.label}
                                        crumb={crumb}
                                        color={color}
                                    />
                                );
                            }
                            return crumb.href ? (
                                <Link
                                    key={crumb.label}
                                    component={InertiaLink}
                                    href={crumb.href}
                                    underline="hover"
                                    sx={{ ...CRUMB_SX, color }}
                                >
                                    {crumb.label}
                                </Link>
                            ) : (
                                <Typography
                                    key={crumb.label}
                                    sx={{ ...CRUMB_SX, color }}
                                >
                                    {crumb.label}
                                </Typography>
                            );
                        })}
                    </MuiBreadcrumbs>
                )}
                <Box
                    sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 1,
                        minWidth: 0,
                        width: "100%",
                    }}
                >
                    {titleContent ? (
                        <>
                            <Typography component="h1" sx={VISUALLY_HIDDEN}>
                                {title}
                            </Typography>
                            {titleContent}
                        </>
                    ) : (
                        <Typography
                            variant="h4"
                            component="h1"
                            fontWeight={800}
                            noWrap
                            sx={{
                                fontSize: { xs: "1.6rem", md: "1.85rem" },
                                letterSpacing: "-0.01em",
                                lineHeight: 1.12,
                                color: harbor.ink,
                            }}
                        >
                            {title}
                        </Typography>
                    )}
                </Box>
            </Box>
            {actions && (
                <Box
                    sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 1,
                        flexShrink: 0,
                        alignSelf: { xs: "stretch", md: "center" },
                        justifyContent: { xs: "flex-start", md: "flex-end" },
                        flexWrap: "wrap",
                    }}
                >
                    {actions}
                </Box>
            )}
        </Box>
    );
}
