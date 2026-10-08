import { harbor } from "@/theme/harbor";
import { Link } from "@inertiajs/react";
import AssignmentIcon from "@mui/icons-material/Assignment";
import GroupsIcon from "@mui/icons-material/Groups";
import ViewKanbanIcon from "@mui/icons-material/ViewKanban";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import type { ReactNode } from "react";
import { dashboardCardSx } from "./DashboardSection";

const STEPS: {
    icon: ReactNode;
    tint: { fg: string; bg: string };
    title: string;
    body: string;
}[] = [
    {
        icon: <GroupsIcon sx={{ fontSize: 20 }} />,
        tint: harbor.tints.indigo,
        title: "Teams",
        body: "A team is a group of people working together. Everyone on a team can see its boards.",
    },
    {
        icon: <ViewKanbanIcon sx={{ fontSize: 20 }} />,
        tint: harbor.tints.copper,
        title: "Boards",
        body: "Each board has columns like To Do, In Progress and Done. Tasks move across as work happens.",
    },
    {
        icon: <AssignmentIcon sx={{ fontSize: 20 }} />,
        tint: harbor.tints.green,
        title: "Your dashboard",
        body: "Tasks assigned to you, upcoming deadlines and recent changes show up here.",
    },
];

/** First-run panel for users who don't belong to any team yet. */
export default function WelcomePanel({ userName }: { userName: string }) {
    const firstName = userName.split(" ")[0] || userName;

    return (
        <Paper
            component="section"
            aria-labelledby="welcome-heading"
            elevation={0}
            sx={{ ...dashboardCardSx, p: { xs: "20px", sm: "28px 32px" } }}
        >
            <Typography
                component="h2"
                id="welcome-heading"
                sx={{
                    fontFamily: harbor.headingFont,
                    fontSize: { xs: 20, sm: 24 },
                    fontWeight: 800,
                    color: harbor.ink,
                }}
            >
                Welcome to PulseBoard, {firstName}
            </Typography>
            <Typography sx={{ fontSize: 14, color: harbor.sub, mt: 0.75 }}>
                You&apos;re not on a team yet. Work in PulseBoard is organized
                into teams and boards — here&apos;s how it fits together.
            </Typography>

            <Box
                component="ol"
                sx={{
                    listStyle: "none",
                    m: 0,
                    p: 0,
                    mt: 3,
                    display: "grid",
                    gridTemplateColumns: {
                        xs: "1fr",
                        md: "repeat(3, minmax(0, 1fr))",
                    },
                    gap: 2,
                }}
            >
                {STEPS.map((step) => (
                    <Box
                        component="li"
                        key={step.title}
                        sx={{
                            bgcolor: harbor.countBg,
                            borderRadius: "12px",
                            p: 2,
                            display: "flex",
                            gap: 1.5,
                            alignItems: "flex-start",
                        }}
                    >
                        <Box
                            aria-hidden="true"
                            sx={{
                                width: 36,
                                height: 36,
                                flex: "none",
                                borderRadius: "10px",
                                bgcolor: step.tint.bg,
                                color: step.tint.fg,
                                display: "grid",
                                placeItems: "center",
                            }}
                        >
                            {step.icon}
                        </Box>
                        <Box sx={{ minWidth: 0 }}>
                            <Typography
                                component="h3"
                                sx={{
                                    fontSize: 14,
                                    fontWeight: 700,
                                    color: harbor.ink,
                                }}
                            >
                                {step.title}
                            </Typography>
                            <Typography
                                sx={{
                                    fontSize: 13,
                                    color: harbor.sub,
                                    mt: 0.25,
                                }}
                            >
                                {step.body}
                            </Typography>
                        </Box>
                    </Box>
                ))}
            </Box>

            <Box
                sx={{
                    display: "flex",
                    alignItems: { xs: "stretch", sm: "center" },
                    flexDirection: { xs: "column", sm: "row" },
                    gap: { xs: 1.5, sm: 2 },
                    mt: 3,
                }}
            >
                <Button
                    component={Link}
                    href={route("teams.index")}
                    variant="contained"
                    size="large"
                >
                    Create or join a team
                </Button>
                <Typography sx={{ fontSize: 13, color: harbor.sub }}>
                    Joining an existing team? Ask one of its owners or admins to
                    add you.
                </Typography>
            </Box>
        </Paper>
    );
}
