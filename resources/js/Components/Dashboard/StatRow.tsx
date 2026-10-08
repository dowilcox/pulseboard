import { harbor } from "@/theme/harbor";
import AssignmentIcon from "@mui/icons-material/Assignment";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import EventIcon from "@mui/icons-material/Event";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import type { ReactNode } from "react";
import { completedDelta } from "./dashboardUtils";
import { dashboardCardSx, focusRingSx } from "./DashboardSection";

interface StatCardProps {
    label: string;
    value: number;
    icon: ReactNode;
    tint: { fg: string; bg: string };
    /** In-page anchor to the section that lists these tasks. */
    href?: string;
    detail?: ReactNode;
    detailColor?: string;
    valueColor?: string;
}

function StatCard({
    label,
    value,
    icon,
    tint,
    href,
    detail,
    detailColor = harbor.sub,
    valueColor = harbor.ink,
}: StatCardProps) {
    return (
        <Paper
            elevation={0}
            {...(href ? { component: "a" as const, href } : {})}
            sx={{
                ...dashboardCardSx,
                p: { xs: "14px", sm: "16px 18px" },
                display: "flex",
                flexDirection: "column",
                gap: 1,
                color: "inherit",
                textDecoration: "none",
                transition: "box-shadow 150ms ease-out",
                ...(href && {
                    "&:hover": { boxShadow: harbor.cardShadowHover },
                    "&:focus-visible": focusRingSx,
                }),
            }}
        >
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Box
                    aria-hidden="true"
                    sx={{
                        width: 30,
                        height: 30,
                        flex: "none",
                        borderRadius: "9px",
                        bgcolor: tint.bg,
                        color: tint.fg,
                        display: "grid",
                        placeItems: "center",
                    }}
                >
                    {icon}
                </Box>
                <Typography
                    component="span"
                    sx={{
                        fontSize: 13,
                        fontWeight: 700,
                        color: harbor.sub,
                        lineHeight: 1.3,
                    }}
                >
                    {label}
                </Typography>
            </Box>
            <Typography
                component="span"
                sx={{
                    fontFamily: harbor.headingFont,
                    fontSize: { xs: 28, sm: 32 },
                    fontWeight: 800,
                    color: valueColor,
                    lineHeight: 1,
                    fontVariantNumeric: "tabular-nums",
                }}
            >
                {value}
            </Typography>
            {detail && (
                <Typography
                    component="span"
                    sx={{ fontSize: 12, fontWeight: 600, color: detailColor }}
                >
                    {detail}
                </Typography>
            )}
        </Paper>
    );
}

interface StatRowProps {
    open: number;
    overdue: number;
    dueNext7Days: number;
    completedLast7Days: number;
    completedPrevious7Days: number;
}

export default function StatRow({
    open,
    overdue,
    dueNext7Days,
    completedLast7Days,
    completedPrevious7Days,
}: StatRowProps) {
    const delta = completedDelta(completedLast7Days, completedPrevious7Days);

    return (
        <Box
            component="section"
            aria-label="Your task summary"
            sx={{
                display: "grid",
                gridTemplateColumns: {
                    xs: "repeat(2, minmax(0, 1fr))",
                    lg: "repeat(4, minmax(0, 1fr))",
                },
                gap: { xs: 1.5, sm: 2 },
            }}
        >
            <StatCard
                label="Open tasks"
                value={open}
                icon={<AssignmentIcon sx={{ fontSize: 17 }} />}
                tint={harbor.tints.indigo}
                href="#my-tasks"
                detail="Assigned to you"
            />
            <StatCard
                label="Overdue"
                value={overdue}
                icon={<WarningAmberIcon sx={{ fontSize: 17 }} />}
                tint={harbor.tints.red}
                href="#overdue"
                valueColor={overdue > 0 ? harbor.dangerText : harbor.ink}
                detail={overdue > 0 ? "Past their due date" : "Nothing overdue"}
            />
            <StatCard
                label="Due in next 7 days"
                value={dueNext7Days}
                icon={<EventIcon sx={{ fontSize: 17 }} />}
                tint={harbor.tints.copper}
                href="#due-soon"
                detail="Including today"
            />
            <StatCard
                label="Completed, last 7 days"
                value={completedLast7Days}
                icon={<CheckCircleIcon sx={{ fontSize: 17 }} />}
                tint={harbor.tints.green}
                detail={delta?.text ?? "Tasks you finished"}
                detailColor={
                    delta?.tone === "up" ? harbor.successText : harbor.sub
                }
            />
        </Box>
    );
}
