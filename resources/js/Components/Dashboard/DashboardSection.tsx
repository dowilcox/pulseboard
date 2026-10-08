import { harbor } from "@/theme/harbor";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import type { ReactNode } from "react";

/** Harbor card shell: cream surface, soft shadow, no border. */
export const dashboardCardSx = {
    p: { xs: "16px", sm: "18px 20px" },
    borderRadius: "16px",
    boxShadow: harbor.cardShadow,
    bgcolor: harbor.card,
    minWidth: 0,
    // Keep in-page anchor targets clear of the sticky app bar.
    scrollMarginTop: "88px",
} as const;

export const VISUALLY_HIDDEN = {
    position: "absolute",
    width: "1px",
    height: "1px",
    p: 0,
    m: "-1px",
    overflow: "hidden",
    clip: "rect(0 0 0 0)",
    whiteSpace: "nowrap",
    border: 0,
} as const;

/** Focus ring for custom link surfaces (cards, rows). */
export const focusRingSx = {
    outline: `2px solid ${harbor.accent}`,
    outlineOffset: "2px",
} as const;

export function CountBadge({ children }: { children: ReactNode }) {
    return (
        <Box
            component="span"
            sx={{
                fontSize: 11.5,
                fontWeight: 700,
                color: harbor.sub,
                bgcolor: harbor.countBg,
                borderRadius: 999,
                px: 1.1,
                py: 0.25,
                lineHeight: 1.5,
            }}
        >
            {children}
        </Box>
    );
}

interface DashboardSectionProps {
    id: string;
    title: string;
    count?: number;
    /** Accessible description of the count, e.g. "12 open tasks". */
    countLabel?: string;
    action?: ReactNode;
    children: ReactNode;
}

export default function DashboardSection({
    id,
    title,
    count,
    countLabel,
    action,
    children,
}: DashboardSectionProps) {
    const headingId = `${id}-heading`;
    return (
        <Paper
            component="section"
            id={id}
            aria-labelledby={headingId}
            elevation={0}
            sx={dashboardCardSx}
        >
            <Box
                sx={{
                    display: "flex",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: 1,
                    mb: 1.5,
                }}
            >
                <Typography
                    component="h2"
                    id={headingId}
                    sx={{
                        fontFamily: harbor.headingFont,
                        fontSize: 17,
                        fontWeight: 700,
                        color: harbor.ink,
                        display: "flex",
                        alignItems: "center",
                        gap: 1,
                    }}
                >
                    {title}
                    {count !== undefined && (
                        <>
                            <CountBadge>
                                <span aria-hidden="true">{count}</span>
                            </CountBadge>
                            <Box component="span" sx={VISUALLY_HIDDEN}>
                                ({countLabel ?? count})
                            </Box>
                        </>
                    )}
                </Typography>
                {action && <Box sx={{ ml: "auto" }}>{action}</Box>}
            </Box>
            {children}
        </Paper>
    );
}

export function EmptyState({
    title,
    children,
}: {
    title: string;
    children?: ReactNode;
}) {
    return (
        <Box
            sx={{
                bgcolor: harbor.countBg,
                borderRadius: "12px",
                px: 2,
                py: 2.5,
                textAlign: "center",
            }}
        >
            <Typography
                sx={{ fontSize: 13.5, fontWeight: 700, color: harbor.ink }}
            >
                {title}
            </Typography>
            {children && (
                <Typography
                    component="div"
                    sx={{ fontSize: 12.5, color: harbor.sub, mt: 0.5 }}
                >
                    {children}
                </Typography>
            )}
        </Box>
    );
}
