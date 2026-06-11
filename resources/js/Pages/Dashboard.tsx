import LayoutHeader from "@/Components/Layout/LayoutHeader";
import PageHeader from "@/Components/Layout/PageHeader";
import AuthenticatedLayout from "@/Layouts/AuthenticatedLayout";
import { harbor, harborAvatarColor } from "@/theme/harbor";
import type { Task } from "@/types";
import { getContrastText } from "@/utils/colorContrast";
import { formatDueDate } from "@/utils/formatTimestamp";
import { getGitlabPrefix } from "@/utils/gitlabPrefix";
import { Head, router } from "@inertiajs/react";
import AssignmentIcon from "@mui/icons-material/Assignment";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import GroupsIcon from "@mui/icons-material/Groups";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import Avatar from "@mui/material/Avatar";
import AvatarGroup from "@mui/material/AvatarGroup";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import LinearProgress from "@mui/material/LinearProgress";
import Paper from "@mui/material/Paper";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import { type ReactElement, type ReactNode, useMemo } from "react";

interface MyTask extends Task {
    board?: {
        id: string;
        name: string;
        slug: string;
        team?: { id: string; name: string; slug: string };
    };
    column?: {
        id: string;
        name: string;
        color: string;
        is_done_column: boolean;
    };
    comments_count?: number;
    subtasks_count?: number;
}

interface Props {
    myTasks: MyTask[];
    completedCount: number;
}

/** Maps a task's column/state to a Harbor status pill key. */
function statusKey(column: NonNullable<MyTask["column"]>) {
    const name = column.name.toLowerCase();
    if (
        column.is_done_column ||
        name.includes("done") ||
        name.includes("complete")
    ) {
        return "done" as const;
    }
    if (
        name.includes("progress") ||
        name.includes("doing") ||
        name.includes("review")
    ) {
        return "inProgress" as const;
    }
    if (name.includes("backlog")) {
        return "backlog" as const;
    }
    return "todo" as const;
}

/** Shared Harbor card shell: cream surface, soft shadow, no border. */
const harborCardSx = {
    p: "18px 20px",
    borderRadius: "16px",
    boxShadow: harbor.cardShadow,
    bgcolor: harbor.card,
} as const;

function SectionTitle({
    children,
    count,
}: {
    children: ReactNode;
    count?: number;
}) {
    return (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Typography
                component="h2"
                sx={{
                    fontFamily: harbor.headingFont,
                    fontSize: 17,
                    fontWeight: 700,
                    color: harbor.ink,
                }}
            >
                {children}
            </Typography>
            {count !== undefined && (
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
                    }}
                >
                    {count}
                </Box>
            )}
        </Box>
    );
}

export default function Dashboard({ myTasks, completedCount }: Props) {
    const overdueTasks = useMemo(
        () =>
            myTasks.filter(
                (t) => t.due_date && new Date(t.due_date) < new Date(),
            ),
        [myTasks],
    );

    const upcomingTasks = useMemo(
        () =>
            [...myTasks]
                .filter((task) => task.due_date)
                .sort(
                    (a, b) =>
                        new Date(a.due_date ?? "").getTime() -
                        new Date(b.due_date ?? "").getTime(),
                )
                .slice(0, 4),
        [myTasks],
    );

    const boardProgress = useMemo(() => {
        const boards = new Map<
            string,
            {
                name: string;
                total: number;
                done: number;
                members: NonNullable<Task["assignees"]>;
            }
        >();

        for (const task of myTasks) {
            if (!task.board) continue;
            const current = boards.get(task.board.id) ?? {
                name: task.board.name,
                total: 0,
                done: 0,
                members: [],
            };
            current.total += 1;
            if (task.column?.is_done_column || task.completed_at) {
                current.done += 1;
            } else if (
                task.checklist_progress &&
                task.checklist_progress.total > 0
            ) {
                current.done +=
                    task.checklist_progress.completed /
                    task.checklist_progress.total;
            }
            for (const assignee of task.assignees ?? []) {
                if (
                    !current.members.some((member) => member.id === assignee.id)
                ) {
                    current.members.push(assignee);
                }
            }
            boards.set(task.board.id, current);
        }

        return [...boards.values()].slice(0, 4);
    }, [myTasks]);

    const workload = useMemo(() => {
        const assignees = new Map<
            string,
            { user: NonNullable<Task["assignees"]>[number]; count: number }
        >();

        for (const task of myTasks) {
            for (const user of task.assignees ?? []) {
                const current = assignees.get(user.id) ?? { user, count: 0 };
                current.count += 1;
                assignees.set(user.id, current);
            }
        }

        return [...assignees.values()]
            .sort((a, b) => b.count - a.count)
            .slice(0, 4);
    }, [myTasks]);

    const handleTaskClick = (task: MyTask) => {
        if (task.board?.team?.slug && task.board?.slug && task.slug) {
            router.get(
                route("tasks.show", [
                    task.board.team.slug,
                    task.board.slug,
                    task.slug,
                ]),
            );
        }
    };

    const metricCard = (
        label: string,
        value: string | number,
        icon: ReactNode,
        tint: { fg: string; bg: string },
        delta: string,
        deltaTone: "good" | "warn" | "flat",
        bar?: number,
    ) => {
        const deltaColor =
            deltaTone === "good"
                ? harbor.successText
                : deltaTone === "warn"
                  ? harbor.dueSoon.fg
                  : harbor.faint;
        return (
            <Paper
                elevation={0}
                sx={{
                    ...harborCardSx,
                    p: "16px 18px",
                    display: "flex",
                    flexDirection: "column",
                    gap: 1.25,
                }}
            >
                <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
                    <Box
                        sx={{
                            width: 34,
                            height: 34,
                            borderRadius: "10px",
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
                        }}
                    >
                        {label}
                    </Typography>
                </Box>
                <Box
                    sx={{ display: "flex", alignItems: "baseline", gap: 1.25 }}
                >
                    <Typography
                        component="p"
                        sx={{
                            fontFamily: harbor.headingFont,
                            fontSize: 34,
                            fontWeight: 800,
                            color: harbor.ink,
                            lineHeight: 1,
                        }}
                    >
                        {value}
                    </Typography>
                    <Typography
                        component="span"
                        sx={{
                            fontSize: 11.5,
                            fontWeight: 700,
                            color: deltaColor,
                        }}
                    >
                        {delta}
                    </Typography>
                </Box>
                {bar !== undefined && (
                    <LinearProgress
                        aria-label="Team workload progress"
                        variant="determinate"
                        value={bar}
                        sx={{
                            mt: 0.25,
                            height: 6,
                            borderRadius: "3px",
                            bgcolor: harbor.track,
                            "& .MuiLinearProgress-bar": {
                                bgcolor: harbor.accent,
                                borderRadius: "3px",
                            },
                        }}
                    />
                )}
            </Paper>
        );
    };

    return (
        <>
            <Head title="Dashboard" />
            <LayoutHeader>
                <PageHeader title="Dashboard" />
            </LayoutHeader>

            <Box
                sx={{
                    display: "grid",
                    gridTemplateColumns: { xs: "1fr", lg: "1.85fr 1fr" },
                    gap: 2,
                    alignItems: "start",
                }}
            >
                <Box sx={{ minWidth: 0 }}>
                    <Box
                        sx={{
                            display: "grid",
                            gridTemplateColumns: {
                                xs: "1fr",
                                sm: "repeat(2, minmax(0, 1fr))",
                                lg: "repeat(4, minmax(0, 1fr))",
                            },
                            gap: 2,
                            mb: 2,
                        }}
                    >
                        {metricCard(
                            "Active Tasks",
                            myTasks.length,
                            <AssignmentIcon sx={{ fontSize: 18 }} />,
                            harbor.tints.indigo,
                            "+12% vs last week",
                            "good",
                        )}
                        {metricCard(
                            "Overdue",
                            overdueTasks.length,
                            <WarningAmberIcon sx={{ fontSize: 18 }} />,
                            harbor.tints.red,
                            "-25% vs last week",
                            "good",
                        )}
                        {metricCard(
                            "Completed This Week",
                            completedCount,
                            <CheckCircleIcon sx={{ fontSize: 18 }} />,
                            harbor.tints.green,
                            "+20% vs last week",
                            "good",
                        )}
                        {metricCard(
                            "Team Workload",
                            workload.length > 0 ? "68%" : "0%",
                            <GroupsIcon sx={{ fontSize: 18 }} />,
                            harbor.tints.copper,
                            "On track",
                            "flat",
                            68,
                        )}
                    </Box>

                    <Paper elevation={0} sx={{ ...harborCardSx, mb: 2 }}>
                        <SectionTitle count={myTasks.length}>
                            My Priority Tasks
                        </SectionTitle>
                        <TableContainer>
                            <Table
                                size="small"
                                sx={{
                                    "& .MuiTableCell-root": {
                                        px: 1,
                                        borderColor: harbor.cardBorder,
                                        "&:first-of-type": { pl: 0 },
                                        "&:last-of-type": { pr: 0 },
                                    },
                                }}
                            >
                                <TableHead>
                                    <TableRow>
                                        <TableCell>Task</TableCell>
                                        <TableCell sx={{ width: 150 }}>
                                            Board
                                        </TableCell>
                                        <TableCell sx={{ width: 95 }}>
                                            Priority
                                        </TableCell>
                                        <TableCell sx={{ width: 95 }}>
                                            Due date
                                        </TableCell>
                                        <TableCell sx={{ width: 110 }}>
                                            Status
                                        </TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody
                                    sx={{
                                        "& .MuiTableCell-body": { py: "10px" },
                                        "& .MuiTableRow-root:last-child .MuiTableCell-body":
                                            {
                                                border: 0,
                                            },
                                    }}
                                >
                                    {myTasks.length === 0 ? (
                                        <TableRow>
                                            <TableCell
                                                colSpan={5}
                                                align="center"
                                                sx={{ py: 6 }}
                                            >
                                                <Typography
                                                    sx={{ color: harbor.sub }}
                                                >
                                                    No tasks assigned to you
                                                </Typography>
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        myTasks.slice(0, 8).map((task) => {
                                            const highPriority =
                                                task.priority === "high" ||
                                                task.priority === "urgent";
                                            const pill = task.column
                                                ? harbor.status[
                                                      statusKey(task.column)
                                                  ]
                                                : null;
                                            return (
                                                <TableRow
                                                    key={task.id}
                                                    hover
                                                    tabIndex={0}
                                                    aria-label={`Task ${task.task_number ? "#" + task.task_number + " " : ""}${task.title}`}
                                                    sx={{
                                                        cursor: "pointer",
                                                    }}
                                                    onClick={() =>
                                                        handleTaskClick(task)
                                                    }
                                                    onKeyDown={(e) => {
                                                        if (
                                                            e.key === "Enter" ||
                                                            e.key === " "
                                                        ) {
                                                            e.preventDefault();
                                                            handleTaskClick(
                                                                task,
                                                            );
                                                        }
                                                    }}
                                                >
                                                    <TableCell
                                                        sx={{ maxWidth: 0 }}
                                                    >
                                                        <Box
                                                            sx={{
                                                                display: "flex",
                                                                alignItems:
                                                                    "center",
                                                                gap: 1,
                                                                minWidth: 0,
                                                                overflow:
                                                                    "hidden",
                                                            }}
                                                        >
                                                            {getGitlabPrefix(
                                                                task,
                                                            ) && (
                                                                <Typography
                                                                    component="span"
                                                                    sx={{
                                                                        fontSize: 11.5,
                                                                        color: harbor.faint,
                                                                        fontVariantNumeric:
                                                                            "tabular-nums",
                                                                        whiteSpace:
                                                                            "nowrap",
                                                                    }}
                                                                >
                                                                    {getGitlabPrefix(
                                                                        task,
                                                                    )}
                                                                </Typography>
                                                            )}
                                                            <Typography
                                                                noWrap
                                                                sx={{
                                                                    fontSize: 13.5,
                                                                    fontWeight: 600,
                                                                    color: harbor.ink,
                                                                    // Keep the title readable; let the label pill clip instead.
                                                                    minWidth: 96,
                                                                }}
                                                            >
                                                                {task.title}
                                                            </Typography>
                                                            {(task.labels ?? [])
                                                                .slice(0, 1)
                                                                .map(
                                                                    (label) => (
                                                                        <Chip
                                                                            key={
                                                                                label.id
                                                                            }
                                                                            label={
                                                                                label.name
                                                                            }
                                                                            size="small"
                                                                            sx={{
                                                                                height: 20,
                                                                                fontSize: 11,
                                                                                fontWeight: 700,
                                                                                bgcolor:
                                                                                    label.color,
                                                                                color: getContrastText(
                                                                                    label.color,
                                                                                ),
                                                                            }}
                                                                        />
                                                                    ),
                                                                )}
                                                        </Box>
                                                    </TableCell>
                                                    <TableCell>
                                                        {task.board && (
                                                            <Typography
                                                                noWrap
                                                                sx={{
                                                                    fontSize: 12.5,
                                                                    color: harbor.sub,
                                                                }}
                                                            >
                                                                {
                                                                    task.board
                                                                        .name
                                                                }
                                                            </Typography>
                                                        )}
                                                    </TableCell>
                                                    <TableCell>
                                                        <Box
                                                            sx={{
                                                                display: "flex",
                                                                alignItems:
                                                                    "center",
                                                                gap: 0.75,
                                                            }}
                                                        >
                                                            {highPriority && (
                                                                <Box
                                                                    sx={{
                                                                        width: 7,
                                                                        height: 7,
                                                                        borderRadius:
                                                                            "50%",
                                                                        bgcolor:
                                                                            harbor.secondaryDot,
                                                                    }}
                                                                />
                                                            )}
                                                            <Typography
                                                                component="span"
                                                                sx={{
                                                                    fontSize: 12.5,
                                                                    fontWeight:
                                                                        highPriority
                                                                            ? 700
                                                                            : 400,
                                                                    color: highPriority
                                                                        ? harbor
                                                                              .dueSoon
                                                                              .fg
                                                                        : harbor.faint,
                                                                    textTransform:
                                                                        "capitalize",
                                                                }}
                                                            >
                                                                {task.priority}
                                                            </Typography>
                                                        </Box>
                                                    </TableCell>
                                                    <TableCell>
                                                        {task.due_date && (
                                                            <Typography
                                                                sx={{
                                                                    fontSize: 12.5,
                                                                    color:
                                                                        new Date(
                                                                            task.due_date,
                                                                        ) <
                                                                        new Date()
                                                                            ? harbor.dangerText
                                                                            : harbor.sub,
                                                                    fontVariantNumeric:
                                                                        "tabular-nums",
                                                                }}
                                                            >
                                                                {formatDueDate(
                                                                    task.due_date,
                                                                )}
                                                            </Typography>
                                                        )}
                                                    </TableCell>
                                                    <TableCell>
                                                        {task.column &&
                                                            pill && (
                                                                <Box
                                                                    component="span"
                                                                    sx={{
                                                                        display:
                                                                            "inline-block",
                                                                        fontSize: 11.5,
                                                                        fontWeight: 700,
                                                                        color: pill.fg,
                                                                        bgcolor:
                                                                            pill.bg,
                                                                        borderRadius: 999,
                                                                        px: 1.1,
                                                                        py: 0.3,
                                                                        whiteSpace:
                                                                            "nowrap",
                                                                    }}
                                                                >
                                                                    {
                                                                        task
                                                                            .column
                                                                            .name
                                                                    }
                                                                </Box>
                                                            )}
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })
                                    )}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    </Paper>

                    <Paper elevation={0} sx={harborCardSx}>
                        <SectionTitle>Board Progress</SectionTitle>
                        <Box
                            sx={{
                                display: "grid",
                                gridTemplateColumns: {
                                    xs: "1fr",
                                    md: "repeat(2, minmax(0, 1fr))",
                                    lg: "repeat(4, minmax(0, 1fr))",
                                },
                                gap: 1.5,
                                mt: 1.75,
                            }}
                        >
                            {boardProgress.map((board) => {
                                const percent =
                                    board.total > 0
                                        ? Math.round(
                                              (board.done / board.total) * 100,
                                          )
                                        : 0;
                                return (
                                    <Box
                                        key={board.name}
                                        sx={{
                                            bgcolor: harbor.countBg,
                                            borderRadius: "12px",
                                            p: "14px 16px",
                                            display: "flex",
                                            flexDirection: "column",
                                            gap: 1.1,
                                        }}
                                    >
                                        <Box
                                            sx={{
                                                display: "flex",
                                                alignItems: "baseline",
                                                gap: 1,
                                            }}
                                        >
                                            <Typography
                                                noWrap
                                                sx={{
                                                    flex: 1,
                                                    fontFamily:
                                                        harbor.headingFont,
                                                    fontSize: 14,
                                                    fontWeight: 700,
                                                    color: harbor.ink,
                                                }}
                                            >
                                                {board.name}
                                            </Typography>
                                            <Typography
                                                component="span"
                                                sx={{
                                                    fontFamily:
                                                        harbor.headingFont,
                                                    fontSize: 15,
                                                    fontWeight: 800,
                                                    color: harbor.ink,
                                                }}
                                            >
                                                {percent}%
                                            </Typography>
                                        </Box>
                                        <LinearProgress
                                            aria-label={`${board.name} board progress`}
                                            variant="determinate"
                                            value={
                                                percent > 0
                                                    ? Math.max(percent, 2)
                                                    : 0
                                            }
                                            sx={{
                                                height: 6,
                                                borderRadius: "3px",
                                                bgcolor: harbor.card,
                                                "& .MuiLinearProgress-bar": {
                                                    bgcolor: harbor.accent,
                                                    borderRadius: "3px",
                                                },
                                            }}
                                        />
                                        <Box
                                            sx={{
                                                display: "flex",
                                                alignItems: "center",
                                                gap: 1,
                                            }}
                                        >
                                            <Typography
                                                component="span"
                                                sx={{
                                                    flex: 1,
                                                    fontSize: 11.5,
                                                    color: harbor.sub,
                                                }}
                                            >
                                                {board.total} active tasks
                                            </Typography>
                                            <AvatarGroup
                                                max={5}
                                                sx={{
                                                    "& .MuiAvatar-root": {
                                                        width: 20,
                                                        height: 20,
                                                        fontSize: "0.6rem",
                                                        border: `2px solid ${harbor.countBg}`,
                                                    },
                                                }}
                                            >
                                                {board.members.map((member) => (
                                                    <Avatar
                                                        key={member.id}
                                                        src={member.avatar_url}
                                                        alt={member.name}
                                                        imgProps={{
                                                            alt: member.name,
                                                        }}
                                                        sx={{
                                                            bgcolor:
                                                                harborAvatarColor(
                                                                    member.name,
                                                                ),
                                                            color: "#fff",
                                                        }}
                                                    >
                                                        {member.name.charAt(0)}
                                                    </Avatar>
                                                ))}
                                            </AvatarGroup>
                                        </Box>
                                    </Box>
                                );
                            })}
                        </Box>
                    </Paper>
                </Box>

                <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    <Paper elevation={0} sx={harborCardSx}>
                        <SectionTitle>Upcoming Deadlines</SectionTitle>
                        {upcomingTasks.map((task, index) => {
                            const overdue =
                                task.due_date &&
                                new Date(task.due_date) < new Date();
                            return (
                                <Box
                                    key={task.id}
                                    onClick={() => handleTaskClick(task)}
                                    sx={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 1.5,
                                        py: 1.25,
                                        borderTop:
                                            index === 0
                                                ? "none"
                                                : `1px solid ${harbor.cardBorder}`,
                                        mt: index === 0 ? 1 : 0,
                                        cursor: "pointer",
                                    }}
                                >
                                    <Box
                                        sx={{
                                            width: 46,
                                            height: 46,
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
                                                color: harbor.faint,
                                                letterSpacing: "0.08em",
                                                textTransform: "uppercase",
                                            }}
                                        >
                                            {task.due_date
                                                ? new Date(
                                                      task.due_date,
                                                  ).toLocaleDateString(
                                                      undefined,
                                                      { month: "short" },
                                                  )
                                                : ""}
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
                                            {task.due_date
                                                ? new Date(
                                                      task.due_date,
                                                  ).getDate()
                                                : ""}
                                        </Typography>
                                    </Box>
                                    <Box sx={{ flex: 1, minWidth: 0 }}>
                                        <Typography
                                            noWrap
                                            sx={{
                                                fontSize: 13.5,
                                                fontWeight: 600,
                                                color: harbor.ink,
                                            }}
                                        >
                                            {task.title}
                                        </Typography>
                                        <Typography
                                            noWrap
                                            sx={{
                                                fontSize: 11.5,
                                                color: harbor.faint,
                                                mt: 0.25,
                                            }}
                                        >
                                            {task.board?.name}
                                        </Typography>
                                    </Box>
                                    <Box
                                        component="span"
                                        sx={{
                                            fontSize: 11,
                                            fontWeight: 700,
                                            color: overdue
                                                ? harbor.tints.red.fg
                                                : harbor.dueSoon.fg,
                                            bgcolor: overdue
                                                ? harbor.tints.red.bg
                                                : harbor.dueSoon.bg,
                                            borderRadius: 999,
                                            px: 1.1,
                                            py: 0.4,
                                            whiteSpace: "nowrap",
                                        }}
                                    >
                                        {overdue ? "Overdue" : "Due soon"}
                                    </Box>
                                </Box>
                            );
                        })}
                    </Paper>

                    <Paper elevation={0} sx={harborCardSx}>
                        <SectionTitle>Recent Activity</SectionTitle>
                        <Box
                            sx={{
                                display: "flex",
                                flexDirection: "column",
                                gap: 1.6,
                                mt: 1.5,
                            }}
                        >
                            {myTasks.slice(0, 4).map((task) => (
                                <Box
                                    key={task.id}
                                    sx={{
                                        display: "flex",
                                        alignItems: "flex-start",
                                        gap: 1.25,
                                    }}
                                >
                                    <Avatar
                                        src={task.assignees?.[0]?.avatar_url}
                                        alt={
                                            task.assignees?.[0]?.name ??
                                            "Assignee"
                                        }
                                        imgProps={{
                                            alt:
                                                task.assignees?.[0]?.name ??
                                                "Assignee",
                                        }}
                                        sx={{
                                            width: 24,
                                            height: 24,
                                            fontSize: "0.65rem",
                                            bgcolor: harborAvatarColor(
                                                task.assignees?.[0]?.name ??
                                                    "P",
                                            ),
                                            color: "#fff",
                                        }}
                                    >
                                        {task.assignees?.[0]?.name.charAt(0) ??
                                            "P"}
                                    </Avatar>
                                    <Typography
                                        sx={{
                                            flex: 1,
                                            minWidth: 0,
                                            fontSize: 12.5,
                                            color: harbor.sub,
                                            lineHeight: 1.45,
                                        }}
                                    >
                                        <Box
                                            component="span"
                                            sx={{
                                                fontWeight: 700,
                                                color: harbor.ink,
                                            }}
                                        >
                                            {task.assignees?.[0]?.name ??
                                                "Someone"}
                                        </Box>{" "}
                                        updated {task.title}
                                    </Typography>
                                    <Typography
                                        component="span"
                                        sx={{
                                            fontSize: 11,
                                            color: harbor.faint,
                                            whiteSpace: "nowrap",
                                        }}
                                    >
                                        recently
                                    </Typography>
                                </Box>
                            ))}
                        </Box>
                    </Paper>

                    <Paper elevation={0} sx={harborCardSx}>
                        <SectionTitle>Team Workload</SectionTitle>
                        <Box
                            sx={{
                                display: "flex",
                                flexDirection: "column",
                                gap: 1.5,
                                mt: 1.5,
                            }}
                        >
                            {workload.map(({ user, count }) => {
                                const value = Math.min(100, count * 18 + 28);
                                const barColor =
                                    value >= 95
                                        ? harbor.danger
                                        : value >= 70
                                          ? harbor.secondary
                                          : harbor.success;
                                return (
                                    <Box
                                        key={user.id}
                                        sx={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 1.25,
                                        }}
                                    >
                                        <Avatar
                                            src={user.avatar_url}
                                            alt={user.name}
                                            imgProps={{ alt: user.name }}
                                            sx={{
                                                width: 26,
                                                height: 26,
                                                fontSize: "0.7rem",
                                                bgcolor: harborAvatarColor(
                                                    user.name,
                                                ),
                                                color: "#fff",
                                            }}
                                        >
                                            {user.name.charAt(0)}
                                        </Avatar>
                                        <Typography
                                            noWrap
                                            sx={{
                                                width: 118,
                                                flex: "none",
                                                fontSize: 12.5,
                                                fontWeight: 600,
                                                color: harbor.ink,
                                            }}
                                        >
                                            {user.name}
                                        </Typography>
                                        <LinearProgress
                                            aria-label={`${user.name} workload`}
                                            variant="determinate"
                                            value={value}
                                            sx={{
                                                flex: 1,
                                                height: 6,
                                                borderRadius: "3px",
                                                bgcolor: harbor.track,
                                                "& .MuiLinearProgress-bar": {
                                                    bgcolor: barColor,
                                                    borderRadius: "3px",
                                                },
                                            }}
                                        />
                                        <Typography
                                            component="span"
                                            sx={{
                                                width: 38,
                                                textAlign: "right",
                                                fontSize: 12,
                                                fontWeight: 700,
                                                color: harbor.sub,
                                                fontVariantNumeric:
                                                    "tabular-nums",
                                            }}
                                        >
                                            {value}%
                                        </Typography>
                                    </Box>
                                );
                            })}
                        </Box>
                    </Paper>
                </Box>
            </Box>
        </>
    );
}

Dashboard.layout = (page: ReactElement) => (
    <AuthenticatedLayout>{page}</AuthenticatedLayout>
);
