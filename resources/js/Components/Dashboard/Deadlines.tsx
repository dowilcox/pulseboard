import { harbor } from "@/theme/harbor";
import { parseDateOnly } from "@/utils/formatTimestamp";
import { Link } from "@inertiajs/react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import ListItemButton from "@mui/material/ListItemButton";
import Typography from "@mui/material/Typography";
import { useState } from "react";
import { describeDueDate, taskHref } from "./dashboardUtils";
import DashboardSection, {
    CountBadge,
    VISUALLY_HIDDEN,
} from "./DashboardSection";
import type { DashboardTask } from "./types";

const INITIAL_VISIBLE = 5;

const TONES = {
    overdue: harbor.tints.red,
    today: harbor.dueSoon,
    soon: harbor.dueSoon,
    later: { fg: harbor.sub, bg: harbor.countBg },
} as const;

function DeadlineRow({ task }: { task: DashboardTask }) {
    const href = taskHref(task);
    if (!task.due_date || !href) return null;
    const date = parseDateOnly(task.due_date);
    const due = describeDueDate(task.due_date);
    const tone = TONES[due.tone];

    return (
        <Box component="li">
            <ListItemButton
                component={Link}
                href={href}
                sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 1.5,
                    px: 1,
                    py: 1,
                    mx: -1,
                    borderRadius: "10px",
                    color: "inherit",
                }}
            >
                <Box
                    aria-hidden="true"
                    sx={{
                        width: 44,
                        height: 44,
                        flex: "none",
                        bgcolor: harbor.countBg,
                        borderRadius: "12px",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                    }}
                >
                    <Typography
                        component="span"
                        sx={{
                            fontSize: 9.5,
                            fontWeight: 700,
                            color: harbor.sub,
                            letterSpacing: "0.08em",
                            textTransform: "uppercase",
                            lineHeight: 1.3,
                        }}
                    >
                        {date.toLocaleDateString(undefined, { month: "short" })}
                    </Typography>
                    <Typography
                        component="span"
                        sx={{
                            fontFamily: harbor.headingFont,
                            fontSize: 17,
                            fontWeight: 800,
                            color: harbor.ink,
                            lineHeight: 1,
                        }}
                    >
                        {date.getDate()}
                    </Typography>
                </Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography
                        sx={{
                            fontSize: 13.5,
                            fontWeight: 600,
                            color: harbor.ink,
                            lineHeight: 1.35,
                            overflow: "hidden",
                            display: "-webkit-box",
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: "vertical",
                            overflowWrap: "anywhere",
                        }}
                    >
                        {task.title}
                    </Typography>
                    <Typography
                        noWrap
                        sx={{ fontSize: 12, color: harbor.sub, mt: 0.25 }}
                    >
                        <Box component="span" sx={VISUALLY_HIDDEN}>
                            on{" "}
                        </Box>
                        {task.board?.name}
                    </Typography>
                </Box>
                <Box
                    component="span"
                    sx={{
                        flex: "none",
                        fontSize: 11,
                        fontWeight: 700,
                        color: tone.fg,
                        bgcolor: tone.bg,
                        borderRadius: 999,
                        px: 1.1,
                        py: 0.4,
                        whiteSpace: "nowrap",
                    }}
                >
                    <Box component="span" sx={VISUALLY_HIDDEN}>
                        , due {date.toLocaleDateString()},{" "}
                    </Box>
                    {due.relative}
                </Box>
            </ListItemButton>
        </Box>
    );
}

function DeadlineGroup({
    id,
    title,
    subtitle,
    tasks,
    emptyText,
}: {
    id: string;
    title: string;
    subtitle?: string;
    tasks: DashboardTask[];
    emptyText: string;
}) {
    const [showAll, setShowAll] = useState(false);
    const visible = showAll ? tasks : tasks.slice(0, INITIAL_VISIBLE);
    const headingId = `${id}-heading`;

    return (
        <Box
            component="section"
            id={id}
            aria-labelledby={headingId}
            sx={{ scrollMarginTop: "88px" }}
        >
            <Box
                sx={{
                    display: "flex",
                    alignItems: "baseline",
                    flexWrap: "wrap",
                    columnGap: 1,
                    mb: 0.5,
                }}
            >
                <Typography
                    component="h3"
                    id={headingId}
                    sx={{
                        fontSize: 13.5,
                        fontWeight: 700,
                        color: harbor.ink,
                        display: "flex",
                        alignItems: "center",
                        gap: 0.75,
                    }}
                >
                    {title}
                    <CountBadge>
                        <span aria-hidden="true">{tasks.length}</span>
                    </CountBadge>
                    <Box component="span" sx={VISUALLY_HIDDEN}>
                        ({tasks.length} {tasks.length === 1 ? "task" : "tasks"})
                    </Box>
                </Typography>
                {subtitle && (
                    <Typography
                        component="span"
                        sx={{ fontSize: 12, color: harbor.sub }}
                    >
                        {subtitle}
                    </Typography>
                )}
            </Box>
            {tasks.length === 0 ? (
                <Typography sx={{ fontSize: 12.5, color: harbor.sub, py: 1 }}>
                    {emptyText}
                </Typography>
            ) : (
                <>
                    <Box component="ul" sx={{ listStyle: "none", m: 0, p: 0 }}>
                        {visible.map((task) => (
                            <DeadlineRow key={task.id} task={task} />
                        ))}
                    </Box>
                    {tasks.length > INITIAL_VISIBLE && (
                        <Button
                            size="small"
                            onClick={() => setShowAll((value) => !value)}
                            aria-expanded={showAll}
                            sx={{ mt: 0.5 }}
                        >
                            {showAll
                                ? "Show fewer"
                                : `Show ${tasks.length - INITIAL_VISIBLE} more`}
                        </Button>
                    )}
                </>
            )}
        </Box>
    );
}

export default function Deadlines({
    overdue,
    dueSoon,
}: {
    overdue: DashboardTask[];
    dueSoon: DashboardTask[];
}) {
    return (
        <DashboardSection id="deadlines" title="Deadlines">
            <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <DeadlineGroup
                    id="overdue"
                    title="Overdue"
                    tasks={overdue}
                    emptyText="Nothing overdue."
                />
                <DeadlineGroup
                    id="due-soon"
                    title="Due soon"
                    subtitle="Next 14 days"
                    tasks={dueSoon}
                    emptyText="Nothing due in the next 14 days."
                />
            </Box>
        </DashboardSection>
    );
}
