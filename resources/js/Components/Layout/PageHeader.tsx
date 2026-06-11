import { Link as InertiaLink } from "@inertiajs/react";
import MuiBreadcrumbs from "@mui/material/Breadcrumbs";
import Link from "@mui/material/Link";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import { harbor } from "@/theme/harbor";
import type { ReactNode } from "react";

// Harbor breadcrumbs: small bold faint trail with "›" separators; the
// trailing crumb steps up to the sub tone.
const CRUMB_SX = {
    fontSize: "12.5px",
    fontWeight: 600,
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
                            display: "flex",
                            alignItems: "center",
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
