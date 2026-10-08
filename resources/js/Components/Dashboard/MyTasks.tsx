import { harbor } from "@/theme/harbor";
import { getContrastText } from "@/utils/colorContrast";
import { getGitlabPrefix } from "@/utils/gitlabPrefix";
import { Link } from "@inertiajs/react";
import RouterLink from "@/Components/Common/RouterLink";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import MuiLink from "@mui/material/Link";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { useMemo, useState } from "react";
import {
    describeDueDate,
    sortTasksByPriority,
    statusKey,
    taskHref,
} from "./dashboardUtils";
import DashboardSection, {
    EmptyState,
    VISUALLY_HIDDEN,
} from "./DashboardSection";
import type { DashboardTask } from "./types";

const INITIAL_VISIBLE = 10;

const PRIORITY_LABELS: Record<DashboardTask["priority"], string> = {
    urgent: "Urgent",
    high: "High",
    medium: "Medium",
    low: "Low",
    none: "No priority",
};
const MAX_LABELS = 2;

/** Rows switch from stacked to columns when the card is wide enough. */
const WIDE = "@container dashboard-tasks (min-width: 600px)";

function LabelChips({ task }: { task: DashboardTask }) {
    const labels = task.labels ?? [];
    if (labels.length === 0) return null;
    const shown = labels.slice(0, MAX_LABELS);
    const hidden = labels.slice(MAX_LABELS);

    return (
        <>
            {shown.map((label) => (
                <Chip
                    key={label.id}
                    label={label.name}
                    size="small"
                    sx={{
                        height: 20,
                        maxWidth: "100%",
                        fontSize: 11,
                        fontWeight: 700,
                        bgcolor: label.color,
                        color: getContrastText(label.color),
                    }}
                />
            ))}
            {hidden.length > 0 && (
                <Tooltip title={hidden.map((label) => label.name).join(", ")}>
                    <Chip
                        label={`+${hidden.length}`}
                        size="small"
                        tabIndex={0}
                        aria-label={`${hidden.length} more ${hidden.length === 1 ? "label" : "labels"}: ${hidden.map((label) => label.name).join(", ")}`}
                        sx={{
                            height: 20,
                            fontSize: 11,
                            fontWeight: 700,
                            bgcolor: harbor.track,
                            color: harbor.sub,
                        }}
                    />
                </Tooltip>
            )}
        </>
    );
}

function TaskRow({ task }: { task: DashboardTask }) {
    const href = taskHref(task);
    const prefix = getGitlabPrefix(task);
    const pill = task.column ? harbor.status[statusKey(task.column)] : null;
    const due = task.due_date ? describeDueDate(task.due_date) : null;
    const highPriority = task.priority === "high" || task.priority === "urgent";
    const boardHref =
        task.board?.team && task.board
            ? route("teams.boards.show", [
                  task.board.team.slug,
                  task.board.slug,
              ])
            : null;

    return (
        <Box
            component="li"
            sx={{
                display: "flex",
                flexDirection: "column",
                gap: 0.75,
                py: 1.25,
                borderTop: `1px solid ${harbor.cardBorder}`,
                "&:first-of-type": { borderTop: "none", pt: 0.5 },
                [WIDE]: {
                    display: "grid",
                    gridTemplateColumns: "minmax(0, 1fr) auto",
                    alignItems: "center",
                    columnGap: 2,
                },
            }}
        >
            <Box sx={{ minWidth: 0 }}>
                <Typography
                    component="div"
                    sx={{
                        fontSize: 13.5,
                        fontWeight: 600,
                        color: harbor.ink,
                        lineHeight: 1.4,
                        overflowWrap: "anywhere",
                    }}
                >
                    {prefix && (
                        <Box
                            component="span"
                            sx={{
                                fontSize: 11.5,
                                color: harbor.faint,
                                mr: 0.75,
                            }}
                        >
                            {prefix}
                        </Box>
                    )}
                    {href ? (
                        <MuiLink
                            component={RouterLink}
                            href={href}
                            underline="hover"
                            sx={{ color: "inherit" }}
                        >
                            {task.title}
                        </MuiLink>
                    ) : (
                        task.title
                    )}
                </Typography>
                <Box
                    sx={{
                        display: "flex",
                        alignItems: "center",
                        flexWrap: "wrap",
                        gap: 0.75,
                        mt: 0.5,
                        minWidth: 0,
                    }}
                >
                    {task.board && (
                        <Typography
                            component="span"
                            sx={{
                                fontSize: 12,
                                color: harbor.sub,
                                minWidth: 0,
                            }}
                        >
                            <Box component="span" sx={VISUALLY_HIDDEN}>
                                Board:{" "}
                            </Box>
                            {boardHref ? (
                                <MuiLink
                                    component={RouterLink}
                                    href={boardHref}
                                    underline="hover"
                                    sx={{ color: "inherit" }}
                                >
                                    {task.board.name}
                                </MuiLink>
                            ) : (
                                task.board.name
                            )}
                        </Typography>
                    )}
                    <LabelChips task={task} />
                </Box>
            </Box>

            <Box
                sx={{
                    display: "flex",
                    alignItems: "center",
                    flexWrap: "wrap",
                    columnGap: 1.5,
                    rowGap: 0.5,
                    [WIDE]: {
                        display: "grid",
                        gridTemplateColumns: "120px 88px 92px",
                        columnGap: 1.5,
                    },
                }}
            >
                <Box sx={{ minWidth: 0 }}>
                    {task.column && pill && (
                        <Box
                            component="span"
                            title={task.column.name}
                            sx={{
                                display: "inline-block",
                                maxWidth: "100%",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                verticalAlign: "middle",
                                fontSize: 11.5,
                                fontWeight: 700,
                                color: pill.fg,
                                bgcolor: pill.bg,
                                borderRadius: 999,
                                px: 1.1,
                                py: 0.3,
                                whiteSpace: "nowrap",
                            }}
                        >
                            <Box component="span" sx={VISUALLY_HIDDEN}>
                                Status:{" "}
                            </Box>
                            {task.column.name}
                        </Box>
                    )}
                </Box>
                <Box
                    sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 0.75,
                    }}
                >
                    {highPriority && (
                        <Box
                            aria-hidden="true"
                            sx={{
                                width: 7,
                                height: 7,
                                flex: "none",
                                borderRadius: "50%",
                                bgcolor: harbor.secondaryDot,
                            }}
                        />
                    )}
                    <Typography
                        component="span"
                        sx={{
                            fontSize: 12.5,
                            fontWeight: highPriority ? 700 : 500,
                            color: highPriority
                                ? harbor.dueSoon.fg
                                : harbor.sub,
                            whiteSpace: "nowrap",
                        }}
                    >
                        <Box component="span" sx={VISUALLY_HIDDEN}>
                            Priority:{" "}
                        </Box>
                        {PRIORITY_LABELS[task.priority] ?? task.priority}
                    </Typography>
                </Box>
                <Typography
                    component="span"
                    title={due?.relative}
                    sx={{
                        fontSize: 12.5,
                        whiteSpace: "nowrap",
                        fontVariantNumeric: "tabular-nums",
                        fontWeight: due?.tone === "overdue" ? 700 : 500,
                        color:
                            due?.tone === "overdue"
                                ? harbor.dangerText
                                : due?.tone === "today"
                                  ? harbor.dueSoon.fg
                                  : harbor.sub,
                    }}
                >
                    {due ? (
                        <>
                            <Box component="span" sx={VISUALLY_HIDDEN}>
                                Due:{" "}
                            </Box>
                            {due.date}
                            {due.tone === "overdue" && (
                                <Box component="span" sx={VISUALLY_HIDDEN}>
                                    {" "}
                                    ({due.relative})
                                </Box>
                            )}
                        </>
                    ) : (
                        <Box component="span" sx={{ color: harbor.faint }}>
                            No due date
                        </Box>
                    )}
                </Typography>
            </Box>
        </Box>
    );
}

export default function MyTasks({
    tasks,
    totalOpen,
}: {
    tasks: DashboardTask[];
    totalOpen: number;
}) {
    const [showAll, setShowAll] = useState(false);
    const sorted = useMemo(() => sortTasksByPriority(tasks), [tasks]);
    const visible = showAll ? sorted : sorted.slice(0, INITIAL_VISIBLE);

    return (
        <DashboardSection
            id="my-tasks"
            title="My tasks"
            count={totalOpen}
            countLabel={`${totalOpen} open`}
        >
            {sorted.length === 0 ? (
                <EmptyState title="Nothing is assigned to you right now">
                    Tasks assigned to you on any of your boards will show up
                    here.
                </EmptyState>
            ) : (
                <Box
                    sx={{
                        containerType: "inline-size",
                        containerName: "dashboard-tasks",
                    }}
                >
                    <Box component="ul" sx={{ listStyle: "none", m: 0, p: 0 }}>
                        {visible.map((task) => (
                            <TaskRow key={task.id} task={task} />
                        ))}
                    </Box>
                    {(sorted.length > INITIAL_VISIBLE ||
                        totalOpen > sorted.length) && (
                        <Box
                            sx={{
                                display: "flex",
                                alignItems: "center",
                                flexWrap: "wrap",
                                gap: 1.5,
                                mt: 1,
                            }}
                        >
                            {sorted.length > INITIAL_VISIBLE && (
                                <Button
                                    size="small"
                                    onClick={() =>
                                        setShowAll((value) => !value)
                                    }
                                    aria-expanded={showAll}
                                >
                                    {showAll
                                        ? "Show fewer"
                                        : `Show all ${sorted.length} tasks`}
                                </Button>
                            )}
                            {showAll && totalOpen > sorted.length && (
                                <Typography
                                    sx={{ fontSize: 12, color: harbor.sub }}
                                >
                                    Showing {sorted.length} of {totalOpen} open
                                    tasks.
                                </Typography>
                            )}
                        </Box>
                    )}
                </Box>
            )}
        </DashboardSection>
    );
}
