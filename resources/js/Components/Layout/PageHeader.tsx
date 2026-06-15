import { Link as InertiaLink } from "@inertiajs/react";
import MuiBreadcrumbs from "@mui/material/Breadcrumbs";
import Link from "@mui/material/Link";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import { harbor } from "@/theme/harbor";
import type { ReactNode } from "react";

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
}

interface PageHeaderProps {
    /** The current page title displayed as h1 */
    title: string;
    /** Breadcrumb trail excluding "Home"; current page title is rendered below, not repeated in breadcrumbs. */
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
                    <Link
                        component={InertiaLink}
                        href={route("dashboard")}
                        underline="hover"
                        sx={{
                            ...CRUMB_SX,
                            gap: 0.5,
                            color:
                                breadcrumbs.length === 0
                                    ? harbor.sub
                                    : harbor.faint,
                        }}
                    >
                        Home
                    </Link>
                    {breadcrumbs.map((crumb, index) => {
                        const isLast = index === breadcrumbs.length - 1;
                        const color = isLast ? harbor.sub : harbor.faint;
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
