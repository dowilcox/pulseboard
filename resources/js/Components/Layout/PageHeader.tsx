import { Link as InertiaLink } from "@inertiajs/react";
import MuiBreadcrumbs from "@mui/material/Breadcrumbs";
import Link from "@mui/material/Link";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import NavigateNextIcon from "@mui/icons-material/NavigateNext";
import type { ReactNode } from "react";

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
            <Box sx={{ minWidth: 0 }}>
                <MuiBreadcrumbs
                    separator={<NavigateNextIcon sx={{ fontSize: 14 }} />}
                    sx={{ mb: 0.25 }}
                    aria-label="breadcrumb"
                >
                    <Link
                        component={InertiaLink}
                        href={route("dashboard")}
                        underline="hover"
                        color="text.secondary"
                        variant="body2"
                        sx={{
                            display: "flex",
                            alignItems: "center",
                            gap: 0.5,
                            fontSize: "0.95rem",
                        }}
                    >
                        Home
                    </Link>
                    {breadcrumbs.map((crumb) =>
                        crumb.href ? (
                            <Link
                                key={crumb.label}
                                component={InertiaLink}
                                href={crumb.href}
                                underline="hover"
                                color="text.secondary"
                                variant="body2"
                                sx={{ fontSize: "0.95rem" }}
                            >
                                {crumb.label}
                            </Link>
                        ) : (
                            <Typography
                                key={crumb.label}
                                variant="body2"
                                color="text.secondary"
                                sx={{ fontSize: "0.95rem" }}
                            >
                                {crumb.label}
                            </Typography>
                        ),
                    )}
                </MuiBreadcrumbs>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    {titleContent ?? (
                        <Typography
                            variant="h4"
                            component="h1"
                            fontWeight={800}
                            noWrap
                            sx={{
                                fontSize: { xs: "1.6rem", md: "1.85rem" },
                                letterSpacing: "-0.04em",
                                lineHeight: 1.12,
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
